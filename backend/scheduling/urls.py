from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import AppointmentViewSet, BusinessHoursView, CalendarViewSet

# Calendars and appointments get the normal auto-generated router URLs.
# BusinessHours is hand-written below since it's not a normal CRUD
# resource (see the comment on BusinessHoursView in views.py).

router = DefaultRouter()
router.register("calendars", CalendarViewSet, basename="calendar")
router.register("appointments", AppointmentViewSet, basename="appointment")

urlpatterns = router.urls + [
    path("business-hours/", BusinessHoursView.as_view(), name="business-hours"),
]
