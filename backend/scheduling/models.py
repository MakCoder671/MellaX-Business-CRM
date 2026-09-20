from django.db import models

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# Calendar stuff. Three models:
#   Calendar       -- a "bucket" of appointments (v1 = just one per
#                      business; multiple staff/room calendars is a Plus
#                      feature for later)
#   Appointment    -- one booked slot on a calendar, tied to a client
#   BusinessHours  -- what days/hours the business is open, one row per
#                      day of the week
# ----------------------------------------------------------------------------


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
    display_order = models.PositiveIntegerField(default=0)  # controls what order calendars show up in when a business has more than one (Plus feature)

    def __str__(self):
        return self.name


class Appointment(TenantScopedModel):
    SOURCE_MANUAL = "manual"  # the business owner typed it in themselves
    SOURCE_LANDING_PAGE = "landing_page_booking"  # a client booked it themselves through the public landing page (Plus feature)
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
    duration_minutes = models.PositiveIntegerField(default=60)  # how long the appointment runs — needed to draw it as a block on the Day view's time grid, not just a single instant
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    source = models.CharField(max_length=24, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)


class BusinessHours(models.Model):
    """
    One row per day of the week (always exactly 7 rows per account — see
    scheduling/views.py's BusinessHoursView for how those 7 rows get
    created automatically). This drives the calendar's default view:
    hours outside these get shown as "Off" instead of being a separate
    thing a business has to configure twice.
    """

    MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY = range(7)  # just a readable way to write 0,1,2,3,4,5,6
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
            # Stops the same business from ever having two "Monday" rows.
            models.UniqueConstraint(
                fields=["business_account", "day_of_week"],
                name="unique_business_hours_per_day",
            )
        ]
