from django.db import models

from common.models import TenantScopedModel


class Calendar(TenantScopedModel):
    TYPE_OWNER = "owner"
    TYPE_STAFF = "staff"
    TYPE_ROOM = "room"
    TYPE_CHOICES = [
        (TYPE_OWNER, "Owner"),
        (TYPE_STAFF, "Staff"),
        (TYPE_ROOM, "Room"),
    ]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_OWNER)
    display_order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name


class Appointment(TenantScopedModel):
    SOURCE_MANUAL = "manual"
    SOURCE_LANDING_PAGE = "landing_page_booking"
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, "Manual"),
        (SOURCE_LANDING_PAGE, "Landing page booking"),
    ]
    STATUS_SCHEDULED = "scheduled"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    calendar = models.ForeignKey(Calendar, on_delete=models.CASCADE, related_name="appointments")
    client = models.ForeignKey("clients.Client", on_delete=models.CASCADE, related_name="appointments")
    datetime = models.DateTimeField()
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    source = models.CharField(max_length=24, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)


class BusinessHours(models.Model):
    MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY = range(7)
    DAY_CHOICES = [
        (MONDAY, "Monday"),
        (TUESDAY, "Tuesday"),
        (WEDNESDAY, "Wednesday"),
        (THURSDAY, "Thursday"),
        (FRIDAY, "Friday"),
        (SATURDAY, "Saturday"),
        (SUNDAY, "Sunday"),
    ]

    business_account = models.ForeignKey(
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,
        related_name="business_hours",
    )
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    open_time = models.TimeField(null=True, blank=True)
    close_time = models.TimeField(null=True, blank=True)
    is_open = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["business_account", "day_of_week"],
                name="unique_business_hours_per_day",
            )
        ]
