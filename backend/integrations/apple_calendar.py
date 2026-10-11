from datetime import datetime, timedelta, timezone as dt_timezone

import caldav
from caldav.lib import error as caldav_error
from django.conf import settings

# ----------------------------------------------------------------------------
# Apple Calendar, through iCloud's CalDAV server. There's no sign-in popup for
# this one. The owner makes an "app specific password" in their Apple account
# and gives it to MellaX, which talks to Apple's calendar server directly.
#
# This module only ever pushes events out. It never reads Apple's events back
# into MellaX (one-way sync, by design).
# ----------------------------------------------------------------------------


class CalendarLoginError(Exception):
    """Apple didn't accept the Apple ID or the app specific password."""


def _client(apple_id, app_password):
    url = settings.APPLE_CALDAV_URL
    # Apple's server is always https. Only a local test server uses plain http,
    # and the client refuses plain http unless we say otherwise.
    return caldav.DAVClient(
        url=url,
        username=apple_id,
        password=app_password,
        require_tls=url.startswith("https"),
    )


def list_calendars(apple_id, app_password):
    client = _client(apple_id, app_password)
    try:
        calendars = client.principal().calendars()
    except caldav_error.AuthorizationError as exc:
        raise CalendarLoginError from exc
    return [{"name": str(c.name or "Calendar"), "url": str(c.url)} for c in calendars]


def save_event(apple_id, app_password, calendar_url, existing_ref, ical_text):
    """Create the event, or overwrite it if we already made one. Returns its address."""
    client = _client(apple_id, app_password)
    calendar = caldav.Calendar(client=client, url=calendar_url)
    if existing_ref:
        caldav.Event(client=client, url=existing_ref, data=ical_text, parent=calendar).save()
        return existing_ref
    event = calendar.save_event(ical_text)
    return str(event.url)


def delete_event(apple_id, app_password, calendar_url, external_ref):
    client = _client(apple_id, app_password)
    calendar = caldav.Calendar(client=client, url=calendar_url)
    try:
        caldav.Event(client=client, url=external_ref, parent=calendar).delete()
    except caldav_error.NotFoundError:
        pass  # already gone on Apple's side, which is the result we wanted anyway


def _escape(text):
    # Calendar text has its own escape rules. Commas, semicolons, and line breaks would break the event otherwise.
    return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line):
    # Calendar lines are limited to 75 characters. Longer ones wrap onto the next line, starting with a space.
    parts = []
    while len(line) > 75:
        parts.append(line[:75])
        line = " " + line[75:]
    parts.append(line)
    return "\r\n".join(parts)


def _utc(dt):
    return dt.astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_event(appointment):
    """Writes one appointment as a calendar event (iCalendar format)."""
    start = appointment.datetime
    end = start + timedelta(minutes=appointment.duration_minutes or 60)
    client = appointment.client
    who = f"{client.first_name} {client.last_name}".strip()
    what = appointment.service.name if appointment.service_id else "Appointment"
    now = datetime.now(dt_timezone.utc)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//MellaX//Calendar Sync//EN",
        "BEGIN:VEVENT",
        f"UID:mellax-appointment-{appointment.pk}@mellax",
        f"DTSTAMP:{_utc(now)}",
        f"DTSTART:{_utc(start)}",
        f"DTEND:{_utc(end)}",
        f"SUMMARY:{_escape(f'{what} with {who}')}",
        f"DESCRIPTION:{_escape('Booked in MellaX.')}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
