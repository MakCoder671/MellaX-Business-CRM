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
        queryset = super().get_queryset()
        calendar_id = self.request.query_params.get("calendar")
        if calendar_id:
            queryset = queryset.filter(calendar_id=calendar_id)
        return queryset


class BusinessHoursView(APIView):
    """Operating Hours (business_plan.MD, Settings): always exactly 7 rows
    (one per weekday) per account, so this is a get-or-seed + bulk-update
    view rather than a plain CRUD ViewSet."""

    def get(self, request):
        existing = {bh.day_of_week: bh for bh in BusinessHours.objects.filter(business_account=request.user)}
        missing = [
            BusinessHours(business_account=request.user, day_of_week=day, is_open=day < 5)
            for day in range(7)
            if day not in existing
        ]
        if missing:
            BusinessHours.objects.bulk_create(missing)
        hours = BusinessHours.objects.filter(business_account=request.user).order_by("day_of_week")
        return Response(BusinessHoursSerializer(hours, many=True).data)

    def put(self, request):
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
