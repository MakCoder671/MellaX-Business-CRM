import logging
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.core.mail import send_mail
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from accounts.models import BusinessAccount
from clients.matching import fill_blank_fields, find_existing_client
from clients.models import Client
from scheduling.availability import open_slots
from scheduling.models import Appointment, Calendar
from services.models import Service

from .models import MAX_GALLERY_PHOTOS, LandingPage, LandingPagePhoto, LandingPageReview
from .serializers import (
    LandingPagePhotoSerializer,
    LandingPageSerializer,
    OwnerReviewSerializer,
    PublicBookingSerializer,
    PublicLandingPageSerializer,
    PublicReviewInputSerializer,
    PublicReviewSerializer,
)

logger = logging.getLogger(__name__)

BOOKING_WINDOW_DAYS = 60  # how far ahead a visitor can pick a day


def _owner_landing_page(user):
    # Every account should have exactly one landing page, auto-created the
    # first time anything touches it (rather than needing a separate
    # "create your landing page" step during onboarding — one less thing
    # to remember to wire up). Shared by every owner-side view below.
    landing_page, _ = LandingPage.objects.get_or_create(
        business_account=user,
        defaults={"slug": f"business-{user.pk}"},
    )
    return landing_page


class MyLandingPageView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/landing-pages/me/ — the logged-in account managing its own page."""

    serializer_class = LandingPageSerializer

    def get_object(self):
        return _owner_landing_page(self.request.user)


class MyLandingPagePhotoListView(generics.ListCreateAPIView):
    """GET/POST /api/landing-pages/me/photos/ — list the gallery, or add a photo to the end of it."""

    serializer_class = LandingPagePhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LandingPagePhoto.objects.filter(landing_page=_owner_landing_page(self.request.user))

    def perform_create(self, serializer):
        landing_page = _owner_landing_page(self.request.user)
        count = landing_page.photos.count()
        if count >= MAX_GALLERY_PHOTOS:
            raise ValidationError({"image": f"Your gallery is full at {MAX_GALLERY_PHOTOS} photos. Remove one to add another."})
        serializer.save(landing_page=landing_page, display_order=count)  # new photos go to the end of the gallery


class MyLandingPagePhotoDetailView(generics.DestroyAPIView):
    """DELETE /api/landing-pages/me/photos/<pk>/ — remove one photo (and its file from storage)."""

    serializer_class = LandingPagePhotoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Scoped to the owner's own page: someone else's photo id just 404s,
        # the same as if it didn't exist at all.
        return LandingPagePhoto.objects.filter(landing_page__business_account=self.request.user)

    def perform_destroy(self, photo):
        photo.image.delete(save=False)  # Django leaves the file on disk when the row goes — clean it up too
        photo.delete()


class MyLandingPagePhotoReorderView(APIView):
    """POST /api/landing-pages/me/photos/reorder/ — body {"order": [id, id, ...]} sets the whole gallery's order in one go."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        order = request.data.get("order")
        if not isinstance(order, list) or not all(isinstance(pk, int) for pk in order):
            return Response({"detail": "Send the photo ids in the order you want them."}, status=status.HTTP_400_BAD_REQUEST)

        photos = {p.pk: p for p in LandingPagePhoto.objects.filter(landing_page__business_account=request.user)}
        if len(order) != len(photos) or set(order) != set(photos.keys()):
            # A partial or stale list would silently leave some photos out of
            # place, so require the full set of this owner's photo ids.
            return Response({"detail": "That list doesn't match this gallery. Reload and try again."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for position, photo_id in enumerate(order):
                photos[photo_id].display_order = position
                photos[photo_id].save(update_fields=["display_order"])

        reordered = LandingPagePhoto.objects.filter(landing_page__business_account=request.user)
        return Response(LandingPagePhotoSerializer(reordered, many=True, context={"request": request}).data)


class PublicLandingPageView(generics.RetrieveAPIView):
    """
    GET /api/landing-pages/public/<slug>/ — the ONLY landing-page endpoint
    the outside world (no login) can reach. This is a deliberately
    separate view + serializer from the authenticated one above, not the
    same view with a permission check toggled off — see the comment at
    the top of serializers.py for why that separation matters.
    """

    serializer_class = PublicLandingPageSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"  # look this up by its slug in the URL, not by numeric ID

    def get_queryset(self):
        return LandingPage.objects.all()


class LandingAvailabilityThrottle(AnonRateThrottle):
    scope = "landing_availability"


class LandingBookingThrottle(AnonRateThrottle):
    scope = "landing_booking"


def _public_booking_landing_page(slug):
    # Booking is gated on the OWNER's plan, not the visitor's (visitors are
    # anonymous). A missing slug and a Basic plan both just say "not
    # available" so the public can't probe which pages exist.
    landing_page = get_object_or_404(LandingPage, slug=slug)
    if not landing_page.booking_available:
        raise PermissionDenied("Online booking isn't available for this business.")
    return landing_page


def _bookable_service(account, service_id):
    service = Service.objects.for_account(account).filter(pk=service_id, is_product=False).first()
    if service is None:
        raise ValidationError({"service": "Pick a service from the list."})
    return service


class PublicLandingPageAvailabilityView(APIView):
    """GET /api/landing-pages/public/<slug>/availability/?service=<id>&date=YYYY-MM-DD"""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LandingAvailabilityThrottle]

    def get(self, request, slug):
        landing_page = _public_booking_landing_page(slug)
        account = landing_page.business_account

        try:
            service_id = int(request.query_params.get("service", ""))
            wanted = date.fromisoformat(request.query_params.get("date", ""))
        except ValueError:
            raise ValidationError({"detail": "Pick a service and a date."})
        service = _bookable_service(account, service_id)

        now = timezone.now()
        today_local = now.astimezone(ZoneInfo(account.time_zone)).date()
        if wanted < today_local:
            raise ValidationError({"date": "That day has already passed."})
        if wanted > today_local + timedelta(days=BOOKING_WINDOW_DAYS):
            raise ValidationError({"date": f"You can book up to {BOOKING_WINDOW_DAYS} days ahead."})

        return Response({"slots": open_slots(account, service, wanted, now)})


class PublicLandingPageBookView(APIView):
    """POST /api/landing-pages/public/<slug>/book/ — a visitor books a slot themselves."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LandingBookingThrottle]

    def post(self, request, slug):
        form = PublicBookingSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data

        # A filled-in honeypot means a bot. Answer like a normal failure so it
        # gets no hint about what the check was.
        if data["website"]:
            raise ValidationError({"detail": "Something went wrong. Please try again."})

        landing_page = _public_booking_landing_page(slug)

        with transaction.atomic():
            # Lock the business's row so two visitors can't both pass the
            # availability check for the same slot and both book it.
            account = BusinessAccount.objects.select_for_update().get(pk=landing_page.business_account_id)
            service = _bookable_service(account, data["service"])

            slots = open_slots(account, service, data["date"], timezone.now())
            wanted_time = data["time"]
            if wanted_time not in slots:
                raise ValidationError({"time": "That time was just taken or isn't open. Pick another."})

            hour, minute = (int(part) for part in wanted_time.split(":"))
            start_local = datetime.combine(data["date"], time(hour, minute), tzinfo=ZoneInfo(account.time_zone))
            start_utc = start_local.astimezone(dt_timezone.utc)

            calendar = Calendar.objects.for_account(account).first()
            if calendar is None:
                calendar = Calendar.objects.create(business_account=account, name="Calendar", type=Calendar.TYPE_OWNER)

            # A returning client (same email or phone) gets this appointment attached to
            # their existing profile. Blank details on that profile get filled in, and
            # anything already saved stays as it is.
            client = find_existing_client(account, data["email"], data["phone"])
            if client is None:
                client = Client.objects.create(
                    business_account=account,
                    first_name=data["first_name"],
                    last_name=data["last_name"],
                    email=data["email"],
                    phone=data["phone"],
                    address=data["address"],
                    city=data["city"],
                    state=data["state"],
                    zip_code=data["zip_code"],
                )
            else:
                fill_blank_fields(
                    client,
                    email=data["email"],
                    phone=data["phone"],
                    address=data["address"],
                    city=data["city"],
                    state=data["state"],
                    zip_code=data["zip_code"],
                )

            appointment = Appointment.objects.create(
                business_account=account,
                calendar=calendar,
                client=client,
                service=service,
                datetime=start_utc,
                duration_minutes=service.duration_minutes,
                status=Appointment.STATUS_SCHEDULED,
                source=Appointment.SOURCE_LANDING_PAGE,
            )

        local_label = start_local.strftime("%A, %B %-d at %-I:%M %p")
        _email_owner_about_booking(account, client, service, local_label)

        return Response(
            {
                "business_name": account.business_name,
                "service": service.name,
                "when": local_label,
                "appointment_id": appointment.pk,
            },
            status=status.HTTP_201_CREATED,
        )


def _email_owner_about_booking(account, client, service, local_label):
    # A mail problem shouldn't turn a successful booking into an error the
    # visitor sees. The appointment is already saved either way, and the
    # calendar still shows it.
    try:
        send_mail(
            subject=f"New online booking: {client.full_name} on {local_label}",
            message=(
                f"{client.full_name} booked {service.name} for {local_label}.\n\n"
                f"Email: {client.email}\nPhone: {client.phone}\n\n"
                "It's on your calendar now, tagged as a landing page booking."
            ),
            from_email=None,
            recipient_list=[account.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Couldn't send the owner a new-booking email for account %s", account.pk)


class LandingReviewThrottle(AnonRateThrottle):
    scope = "landing_review"


class PublicLandingPageReviewView(APIView):
    """POST /api/landing-pages/public/<slug>/reviews/ — a visitor leaves a review.
    It stays hidden until the owner approves it. Available on every plan."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [LandingReviewThrottle]

    def post(self, request, slug):
        landing_page = get_object_or_404(LandingPage, slug=slug)
        form = PublicReviewInputSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        data = form.validated_data
        if data["website"]:
            raise ValidationError({"detail": "Something went wrong. Please try again."})

        LandingPageReview.objects.create(
            landing_page=landing_page,
            author_name=data["author_name"],
            rating=data["rating"],
            text=data["text"],
            is_approved=False,
        )
        return Response(
            {"detail": "Thanks! Your review will show on the page once it's approved."},
            status=status.HTTP_201_CREATED,
        )


class MyLandingPageReviewListView(generics.ListAPIView):
    """GET /api/landing-pages/me/reviews/ — every review, waiting ones first."""

    serializer_class = OwnerReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LandingPageReview.objects.filter(
            landing_page__business_account=self.request.user
        ).order_by("is_approved", "-created_at")


class MyLandingPageReviewApproveView(APIView):
    """POST /api/landing-pages/me/reviews/<pk>/approve/ — publish one review."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        review = get_object_or_404(LandingPageReview, pk=pk, landing_page__business_account=request.user)
        review.is_approved = True
        review.save(update_fields=["is_approved"])
        return Response(OwnerReviewSerializer(review).data)


class MyLandingPageReviewDetailView(generics.DestroyAPIView):
    """DELETE /api/landing-pages/me/reviews/<pk>/ — remove a review, approved or not."""

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LandingPageReview.objects.filter(landing_page__business_account=self.request.user)
