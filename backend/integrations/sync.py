from datetime import timedelta

from caldav.lib import error as caldav_error
from django.utils import timezone

from scheduling.models import Appointment

from . import apple_calendar
from .crypto import decrypt_secrets
from .models import AppointmentSyncLink, IntegrationConnection

# ----------------------------------------------------------------------------
# Keeps connected calendars in step with MellaX. These functions run after a
# save has committed (see signals.py), so a slow or failing calendar never
# blocks an appointment from saving. Problems are written onto the connection
# in plain language, so the owner sees what's wrong on the Integrations page.
# ----------------------------------------------------------------------------

# When an integration is first connected, we only send appointments from a day
# back up to this many days ahead. Older bookings aren't worth copying across.
BACKFILL_DAYS_AHEAD = 180


def _record_error(connection, exc):
    if isinstance(exc, apple_calendar.CalendarLoginError) or isinstance(exc, caldav_error.AuthorizationError):
        note = "Apple no longer accepts this password. Create a new app specific password and reconnect."
    else:
        note = "Couldn't update your calendar. It will try again the next time this appointment changes."
    connection.status = IntegrationConnection.STATUS_ERROR
    connection.last_error = note
    connection.save(update_fields=["status", "last_error"])


def _mark_working(connection):
    # A good sync clears any old problem note.
    if connection.status != IntegrationConnection.STATUS_CONNECTED or connection.last_error:
        connection.status = IntegrationConnection.STATUS_CONNECTED
        connection.last_error = ""
        connection.save(update_fields=["status", "last_error"])


def _sync_apple(connection, appointment):
    creds = decrypt_secrets(connection.secrets)
    calendar_url = connection.options["calendar_url"]
    link = AppointmentSyncLink.objects.filter(appointment=appointment, connection=connection).first()

    # Cancelled appointments come off the calendar. Everything else goes on it, or gets updated.
    if appointment.status == Appointment.STATUS_CANCELLED:
        if link:
            apple_calendar.delete_event(creds["apple_id"], creds["app_password"], calendar_url, link.external_ref)
            link.delete()
        return

    event_text = apple_calendar.build_event(appointment)
    existing_ref = link.external_ref if link else None
    try:
        ref = apple_calendar.save_event(creds["apple_id"], creds["app_password"], calendar_url, existing_ref, event_text)
    except caldav_error.NotFoundError:
        # Someone deleted the event on Apple's side. Make a fresh one instead.
        ref = apple_calendar.save_event(creds["apple_id"], creds["app_password"], calendar_url, None, event_text)

    if link is None:
        AppointmentSyncLink.objects.create(appointment=appointment, connection=connection, external_ref=ref)
    elif link.external_ref != ref:
        link.external_ref = ref
        link.save(update_fields=["external_ref"])


def sync_appointment_now(appointment_id):
    # Runs after the save commits, so it reads the newest version of the appointment.
    appointment = Appointment.objects.select_related("client", "service").filter(pk=appointment_id).first()
    if appointment is None:
        return
    # Errored connections are tried again too. Otherwise one failed push would
    # stop every later change from reaching the calendar until the owner reconnects.
    connections = IntegrationConnection.objects.filter(
        business_account_id=appointment.business_account_id,
        integration="apple_calendar",
    )
    for connection in connections:
        try:
            _sync_apple(connection, appointment)
            _mark_working(connection)
        except Exception as exc:  # any failure is recorded, never raised into the booking
            _record_error(connection, exc)


def remove_links_now(sync_refs):
    # Runs after an appointment is deleted. The links are gone from the database by then,
    # so the references were saved up front and are passed in here.
    for connection_id, external_ref in sync_refs:
        connection = IntegrationConnection.objects.filter(pk=connection_id).first()
        if connection is None or connection.integration != "apple_calendar":
            continue
        try:
            creds = decrypt_secrets(connection.secrets)
            apple_calendar.delete_event(creds["apple_id"], creds["app_password"], connection.options["calendar_url"], external_ref)
            _mark_working(connection)
        except Exception as exc:
            _record_error(connection, exc)


def backfill(connection):
    # Sends the upcoming appointments when an integration is first connected.
    if connection.integration != "apple_calendar":
        return
    now = timezone.now()
    upcoming = (
        Appointment.objects.for_account(connection.business_account)
        .filter(datetime__gte=now - timedelta(days=1), datetime__lte=now + timedelta(days=BACKFILL_DAYS_AHEAD))
        .exclude(status=Appointment.STATUS_CANCELLED)
        .select_related("client", "service")
        .order_by("datetime")
    )
    for appointment in upcoming:
        try:
            _sync_apple(connection, appointment)
            _mark_working(connection)
        except Exception as exc:
            _record_error(connection, exc)
            break  # if one fails, the rest probably will too, so stop and show the owner the note
