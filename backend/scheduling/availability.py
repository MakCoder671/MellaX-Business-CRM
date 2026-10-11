from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from .models import Appointment, BusinessHours, Calendar

# ----------------------------------------------------------------------------
# Shared slot math for the public landing page's booking (and the same
# double-booking rule the owner's own calendar enforces). Everything here
# works in the business's own timezone (account.time_zone, via zoneinfo, so
# DST is handled by the tz database) and only converts to UTC when comparing
# against stored appointments, which are stored in UTC.
# ----------------------------------------------------------------------------

SLOT_STEP = timedelta(minutes=30)


def conflicts(account, calendar, start_utc, duration_minutes, exclude_pk=None):
    # Two time ranges [a_start, a_end) and [b_start, b_end) overlap exactly
    # when a_start < b_end AND b_start < a_end. Cancelled appointments never
    # block anything.
    end_utc = start_utc + timedelta(minutes=duration_minutes)
    others = Appointment.objects.for_account(account).filter(calendar=calendar).exclude(
        status=Appointment.STATUS_CANCELLED
    )
    if exclude_pk is not None:
        others = others.exclude(pk=exclude_pk)
    for other in others:
        other_end = other.datetime + timedelta(minutes=other.duration_minutes)
        if start_utc < other_end and other.datetime < end_utc:
            return True
    return False


def open_slots(account, service, local_date, now):
    """
    The "HH:MM" start times (in the business's own timezone) where a
    service-length appointment fits on local_date. Empty if the day is closed
    or not configured, if the time has already passed, or if it would overlap
    an existing appointment (unless double booking is allowed).
    """
    tz = ZoneInfo(account.time_zone)
    hours = BusinessHours.objects.filter(business_account=account, day_of_week=local_date.weekday()).first()
    if hours is None or not hours.is_open or hours.open_time is None or hours.close_time is None:
        return []

    day_open = datetime.combine(local_date, hours.open_time, tzinfo=tz)
    day_close = datetime.combine(local_date, hours.close_time, tzinfo=tz)
    duration = timedelta(minutes=service.duration_minutes)

    calendar = Calendar.objects.for_account(account).first()
    check_overlaps = calendar is not None and not account.allow_double_booking

    slots = []
    start = day_open
    while start + duration <= day_close:
        start_utc = start.astimezone(dt_timezone.utc)
        if start_utc > now and not (check_overlaps and conflicts(account, calendar, start_utc, service.duration_minutes)):
            slots.append(start.strftime("%H:%M"))
        start += SLOT_STEP
    return slots
