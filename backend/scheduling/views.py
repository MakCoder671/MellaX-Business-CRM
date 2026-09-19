from common.views import TenantScopedModelViewSet
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Appointment, BusinessHours, Calendar
from .serializers import AppointmentSerializer, BusinessHoursSerializer, CalendarSerializer


class CalendarViewSet(TenantScopedModelViewSet):
    queryset = Calendar.objects.all()
    serializer_class = CalendarSerializer


class AppointmentViewSet(TenantScopedModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        # Lets the frontend ask for just one calendar's appointments via
        # ?calendar=3, instead of always getting every appointment across
        # every calendar the account has.
        queryset = super().get_queryset()
        calendar_id = self.request.query_params.get("calendar")
        if calendar_id:
            queryset = queryset.filter(calendar_id=calendar_id)
        return queryset


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
            BusinessHours(business_account=request.user, day_of_week=day, is_open=day < 5)  # day < 5 -> Mon(0) through Fri(4) are open by default
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
