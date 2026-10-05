from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LandingPage, LandingPagePhoto
from .serializers import LandingPagePhotoSerializer, LandingPageSerializer, PublicLandingPageSerializer


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
        next_order = landing_page.photos.count()  # new photos go to the end of the gallery
        serializer.save(landing_page=landing_page, display_order=next_order)


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
