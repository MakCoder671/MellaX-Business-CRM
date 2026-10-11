from datetime import datetime, timezone as dt_timezone

from django.db import transaction

from .crypto import decrypt_secrets
from .models import IntegrationConnection
from .outbound import OutboundError, add_to_audience, post_json

# ----------------------------------------------------------------------------
# The "something just happened" messages. A booking, a paid invoice, or a new
# client gets sent to whichever of Slack, Zapier, and Mailchimp the owner has
# connected. This runs after the save commits, so a slow or failed send never
# blocks the booking or the payment.
# ----------------------------------------------------------------------------

OUTBOUND = ("zapier", "slack", "mailchimp")


def notify(account_id, event, data):
    transaction.on_commit(lambda: deliver(account_id, event, data))


def deliver(account_id, event, data):
    connections = IntegrationConnection.objects.filter(business_account_id=account_id, integration__in=OUTBOUND)
    for connection in connections:
        try:
            send_one(connection, event, data)
            _mark_working(connection)
        except OutboundError as exc:
            _record(connection, exc.message)
        except Exception:  # any surprise is noted for the owner, never raised into the booking
            _record(connection, "Couldn't send to this app right now. It will try again on the next change.")


def send_one(connection, event, data):
    creds = decrypt_secrets(connection.secrets)
    if connection.integration == "zapier":
        post_json(creds["webhook_url"], {
            "event": event,
            "sent_at": datetime.now(dt_timezone.utc).isoformat(),
            "data": data,
        })
    elif connection.integration == "slack":
        text = slack_text(event, data)
        if text:
            post_json(creds["webhook_url"], {"text": text})
    elif connection.integration == "mailchimp":
        if event == "client.created" and data.get("email"):
            add_to_audience(creds["api_key"], connection.options["audience_id"], data["email"], data.get("first_name", ""), data.get("last_name", ""))


def slack_text(event, data):
    # Slack only gets the two messages a business watches for. Everything else would be noise.
    if event == "appointment.booked":
        return f"New booking: {data.get('service') or 'appointment'} with {data['client']}, {data['when']}."
    if event == "invoice.paid":
        return f"Paid: invoice {data['invoice_number']} from {data['client']} for ${data['total']}."
    return None


def _mark_working(connection):
    if connection.status != IntegrationConnection.STATUS_CONNECTED or connection.last_error:
        connection.status = IntegrationConnection.STATUS_CONNECTED
        connection.last_error = ""
        connection.save(update_fields=["status", "last_error"])


def _record(connection, message):
    connection.status = IntegrationConnection.STATUS_ERROR
    connection.last_error = message
    connection.save(update_fields=["status", "last_error"])
