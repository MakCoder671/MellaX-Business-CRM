import uuid
from calendar import monthrange
from datetime import timedelta

from common.views import TenantScopedModelViewSet
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Appointment, BusinessHours, Calendar
from .serializers import AppointmentSerializer, BusinessHoursSerializer, CalendarSerializer


def _add_months(dt, months):
    # Plain month math instead of pulling in python-dateutil for one
    # function — walks the month/year forward `months` times and clips
    # the day back to the target month's last day if it doesn't have one
    # (e.g. Jan 31 + 1 month lands on Feb 28, not an invalid "Feb 31").
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


class CalendarViewSet(TenantScopedModelViewSet):
    queryset = Calendar.objects.all()
    serializer_class = CalendarSerializer

    @action(detail=False, methods=["get"])
    def default(self, request):
        """
        GET /api/scheduling/calendars/default/ — v1 is "single/default
        calendar" per the plan doc (multiple staff/room calendars are a
        Plus feature for later), so instead of making the frontend deal
        with "create a calendar" as its own setup step, this just hands
        back the account's one calendar, creating it the first time
        anyone asks — same lazy-creation pattern as the landing page
        (see landingpages/views.py's MyLandingPageView).
        """
        calendar = Calendar.objects.for_account(request.user).first()
        if calendar is None:
            calendar = Calendar.objects.create(
                business_account=request.user, name="Calendar", type=Calendar.TYPE_OWNER
            )
        return Response(CalendarSerializer(calendar).data)


class AppointmentViewSet(TenantScopedModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        # Lets the frontend ask for just one calendar's appointments via
        # ?calendar=3, or just one client's (the client profile's
        # Appointments tab) via ?client=5, instead of always getting
        # every appointment across every calendar the account has.
        queryset = super().get_queryset()
        calendar_id = self.request.query_params.get("calendar")
        if calendar_id:
            queryset = queryset.filter(calendar_id=calendar_id)
        client_id = self.request.query_params.get("client")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset.order_by("-datetime")

    def perform_destroy(self, instance):
        # Same rule as the serializer's update() lock — an invoiced
        # appointment can't be deleted out from under its invoice either.
        if instance.invoices.exists():
            raise PermissionDenied(
                "This appointment has already been invoiced. Delete the invoice first if you need to remove it."
            )
        instance.delete()

    @action(detail=False, methods=["post"])
    def recurring(self, request):
        """
        POST /api/scheduling/appointments/recurring/ — creates a whole
        series of appointments from one recurrence rule (weekly,
        biweekly, or monthly) instead of someone clicking "Add
        appointment" over and over for a client who books the same slot
        every week. Takes the same fields as a normal appointment create,
        plus `frequency` and `occurrences`.
        Each occurrence runs through the exact same AppointmentSerializer
        validation as a one-off appointment (so double-booking still gets
        caught) — a date that conflicts is skipped rather than failing
        the whole series, since every OTHER occurrence is still perfectly
        valid and there's no reason to block those too.
        """
        data = request.data
        frequency = data.get("frequency")
        if frequency not in ("weekly", "biweekly", "monthly"):
            return Response({"detail": "frequency must be weekly, biweekly, or monthly."}, status=400)

        try:
            occurrences = int(data.get("occurrences", 0))
        except (TypeError, ValueError):
            occurrences = 0
        if occurrences < 2 or occurrences > 52:
            return Response({"detail": "occurrences must be between 2 and 52."}, status=400)

        base_start = parse_datetime(data.get("datetime", ""))
        if base_start is None:
            return Response({"detail": "A valid datetime is required."}, status=400)

        recurrence_id = uuid.uuid4()
        created = []
        skipped = []

        for i in range(occurrences):
            if frequency == "weekly":
                occurrence_start = base_start + timedelta(days=7 * i)
            elif frequency == "biweekly":
                occurrence_start = base_start + timedelta(days=14 * i)
            else:
                occurrence_start = _add_months(base_start, i)

            payload = {**data, "datetime": occurrence_start.isoformat()}
            serializer = AppointmentSerializer(data=payload, context={"request": request})
            if serializer.is_valid():
                serializer.save(business_account=request.user, recurrence_id=recurrence_id)
                created.append(serializer.data)
            else:
                skipped.append({"datetime": occurrence_start.isoformat(), "errors": serializer.errors})

        return Response({"created": created, "skipped": skipped}, status=201)


class BusinessHoursView(APIView):
    """
    This ISN'T a normal ViewSet, on purpose. BusinessHours is always
    exactly 7 rows per account (one per weekday) — there's no "create a
    new one" or "delete one" concept, just "get all 7" and "update all 7
    at once." A plain APIView with custom get/put methods fits that
    better than the standard list/create/retrieve/update/delete shape.
    """

    def get(self, request):
        # First, figure out which of the 7 days this account doesn't have
        # a row for yet (e.g. a brand new account has none at all) and
        # create sensible defaults for those — open Mon-Fri, closed
        # Sat/Sun — so the frontend always gets back a full week, even for
        # a fresh account we've never touched before.
        existing = {bh.day_of_week: bh for bh in BusinessHours.objects.filter(business_account=request.user)}
        missing = [
            BusinessHours(
                business_account=request.user,
                day_of_week=day,
                is_open=day < 5,  # day < 5 -> Mon(0) through Fri(4) are open by default
                # An open day needs actual hours, not just an is_open flag
                # — leaving these null on a day marked open is exactly the
                # bug that made the Calendar show every day as "Off"
                # regardless of is_open (see CalendarWeekView.tsx).
                open_time="09:00:00" if day < 5 else None,
                close_time="17:00:00" if day < 5 else None,
            )
            for day in range(7)
            if day not in existing
        ]
        if missing:
            BusinessHours.objects.bulk_create(missing)

        hours = BusinessHours.objects.filter(business_account=request.user).order_by("day_of_week")
        return Response(BusinessHoursSerializer(hours, many=True).data)

    def put(self, request):
        # Expects a list of 7 day objects in the request body and updates
        # each one. get_or_create means it also works fine even if some
        # days somehow don't exist in the database yet.
        updated = []
        for entry in request.data:
            bh, _ = BusinessHours.objects.get_or_create(
                business_account=request.user, day_of_week=entry["day_of_week"]
            )
            serializer = BusinessHoursSerializer(bh, data=entry, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            updated.append(serializer.data)
        return Response(updated)
