from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import AppointmentViewSet, BusinessHoursView, CalendarViewSet

router = DefaultRouter()
router.register("calendars", CalendarViewSet, basename="calendar")
router.register("appointments", AppointmentViewSet, basename="appointment")

urlpatterns = router.urls + [
    path("business-hours/", BusinessHoursView.as_view(), name="business-hours"),
]
