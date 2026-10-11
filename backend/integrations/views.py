from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import apple_calendar, stripe_api, sync
from .outbound import OutboundError, check_mailchimp, post_json
from .catalog import ACCESS_INCLUDED, ACCESS_ONE_TIME, ACCESS_OWNED, ACCESS_UPGRADE, CATALOG, access_for, find
from .crypto import encrypt_secrets
from .models import IntegrationConnection, IntegrationEntitlement
from .stripe_api import StripeError

# ----------------------------------------------------------------------------
# The Integrations tab's API. Every plan can read the whole catalog. Connecting
# is checked against the owner's plan and purchases here on the server, so the
# page can't be tricked into skipping the rules.
# ----------------------------------------------------------------------------

ACCESS_MESSAGES = {
    ACCESS_ONE_TIME: "This one is a one-time purchase. Buy it to connect.",
    ACCESS_UPGRADE: "This one comes with Plus. Upgrade to connect it.",
}


def _owned_keys(account):
    return set(IntegrationEntitlement.objects.for_account(account).values_list("integration", flat=True))


def _status_for(entry, connection):
    if not entry["available"]:
        return "coming_soon"
    if connection is None:
        return "not_connected"
    return connection.status


def _summary(entry, account, owned, connection):
    return {
        "key": entry["key"],
        "name": entry["name"],
        "category": entry["category"],
        "tier": entry["tier"],
        "tagline": entry["tagline"],
        "sync": entry["sync"],
        "access": access_for(entry, account.plan_tier, owned),
        "status": _status_for(entry, connection),
        "last_error": connection.last_error if connection else "",
    }


class IntegrationListView(APIView):
    """GET /api/integrations/ — the whole store, with what this account can do with each one."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        owned = _owned_keys(request.user)
        connections = {c.integration: c for c in IntegrationConnection.objects.for_account(request.user)}
        return Response([_summary(e, request.user, owned, connections.get(e["key"])) for e in CATALOG])


class IntegrationDetailView(APIView):
    """GET /api/integrations/<key>/ — one entry's full page: what it does, the steps, and the fields to fill in."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, key):
        entry = find(key)
        if entry is None:
            return Response({"detail": "We couldn't find that integration."}, status=status.HTTP_404_NOT_FOUND)
        owned = _owned_keys(request.user)
        connection = IntegrationConnection.objects.for_account(request.user).filter(integration=key).first()
        data = _summary(entry, request.user, owned, connection)
        data.update({"guide": entry["guide"], "fields": entry["fields"]})
        return Response(data)


class IntegrationConnectView(APIView):
    """POST /api/integrations/<key>/connect/ — connect it, if the plan and any purchase allow it."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, key):
        entry = find(key)
        if entry is None:
            return Response({"detail": "We couldn't find that integration."}, status=status.HTTP_404_NOT_FOUND)
        # Plan and purchase are checked first, so a Basic owner is told to upgrade
        # rather than hearing that a Plus-only integration isn't ready.
        access = access_for(entry, request.user.plan_tier, _owned_keys(request.user))
        if access not in (ACCESS_INCLUDED, ACCESS_OWNED):
            return Response({"detail": ACCESS_MESSAGES[access], "access": access}, status=status.HTTP_403_FORBIDDEN)

        # Demo accounts can explore everything except actually taking real money -
        # per Mako, that's the one thing that waits until an account is activated
        # from demo to live (see accounts/models.py's subscription_status).
        if entry["category"] == "Payments" and request.user.subscription_status == request.user.STATUS_TRIALING:
            return Response(
                {"detail": "Payment processors aren't available on a demo account yet. Once your account is activated, you can connect this yourself."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not entry["available"]:
            return Response(
                {"detail": "This one isn't ready yet. We're finishing its setup."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if key == "apple_calendar":
            return _connect_apple(request, entry)
        if key == "stripe":
            return _connect_stripe(request, entry)
        if key in ("slack", "zapier"):
            return _connect_webhook(request, entry)
        if key == "mailchimp":
            return _connect_mailchimp(request, entry)
        return Response({"detail": "This one can't be connected yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


def _connect_apple(request, entry):
    apple_id = str(request.data.get("apple_id", "")).strip()
    app_password = str(request.data.get("app_password", "")).strip()
    calendar_url = str(request.data.get("calendar_url", "")).strip()
    if not apple_id or not app_password:
        return Response({"detail": "Enter your Apple ID and app specific password."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        calendars = apple_calendar.list_calendars(apple_id, app_password)
    except apple_calendar.CalendarLoginError:
        return Response(
            {"detail": "Apple didn't accept that Apple ID or password. Check both and try again."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        return Response(
            {"detail": "We couldn't reach Apple right now. Try again in a few minutes."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # First step: they've signed in, now they pick a calendar from the list Apple returned.
    if not calendar_url:
        return Response({"needs_calendar": True, "calendars": calendars})

    # Only a calendar from that list is accepted, so the server never reaches out to an address it wasn't given.
    chosen = next((c for c in calendars if c["url"] == calendar_url), None)
    if chosen is None:
        return Response({"detail": "Pick one of the calendars from your Apple account."}, status=status.HTTP_400_BAD_REQUEST)

    connection, _ = IntegrationConnection.objects.update_or_create(
        business_account=request.user,
        integration=entry["key"],
        defaults={
            "secrets": encrypt_secrets({"apple_id": apple_id, "app_password": app_password}),
            "options": {"calendar_url": chosen["url"], "calendar_name": chosen["name"]},
            "status": IntegrationConnection.STATUS_CONNECTED,
            "last_error": "",
        },
    )
    # Send the upcoming appointments across right away, so the calendar isn't empty on day one.
    sync.backfill(connection)
    connection.refresh_from_db()
    return Response(
        _summary(entry, request.user, _owned_keys(request.user), connection),
        status=status.HTTP_201_CREATED,
    )


# Each webhook link must be the one the app gave out, so the server never sends to an address it doesn't expect.
WEBHOOK_PREFIXES = {
    "slack": "https://hooks.slack.com/",
    "zapier": "https://hooks.zapier.com/",
}


def _connect_webhook(request, entry):
    key = entry["key"]
    url = str(request.data.get("webhook_url", "")).strip()
    if not url:
        return Response({"detail": "Paste the webhook link."}, status=status.HTTP_400_BAD_REQUEST)
    if not url.startswith(WEBHOOK_PREFIXES[key]):
        return Response(
            {"detail": f"That doesn't look like a {entry['name']} link. It should start with {WEBHOOK_PREFIXES[key]}"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    hello = "MellaX is connected. You'll see new bookings, paid invoices, and new clients here from now on."
    try:
        post_json(url, {"text": hello} if key == "slack" else {"event": "mellax.connected", "message": hello})
    except OutboundError as exc:
        return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

    connection, _ = IntegrationConnection.objects.update_or_create(
        business_account=request.user,
        integration=key,
        defaults={
            "secrets": encrypt_secrets({"webhook_url": url}),
            "options": {},
            "status": IntegrationConnection.STATUS_CONNECTED,
            "last_error": "",
        },
    )
    return Response(_summary(entry, request.user, _owned_keys(request.user), connection), status=status.HTTP_201_CREATED)


def _connect_mailchimp(request, entry):
    api_key = str(request.data.get("api_key", "")).strip()
    audience_id = str(request.data.get("audience_id", "")).strip()
    if not api_key or not audience_id:
        return Response({"detail": "Paste your Mailchimp API key and your Audience ID."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        check_mailchimp(api_key, audience_id)
    except OutboundError as exc:
        return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

    connection, _ = IntegrationConnection.objects.update_or_create(
        business_account=request.user,
        integration=entry["key"],
        defaults={
            "secrets": encrypt_secrets({"api_key": api_key}),
            "options": {"audience_id": audience_id},
            "status": IntegrationConnection.STATUS_CONNECTED,
            "last_error": "",
        },
    )
    return Response(_summary(entry, request.user, _owned_keys(request.user), connection), status=status.HTTP_201_CREATED)


def _connect_stripe(request, entry):
    secret_key = str(request.data.get("secret_key", "")).strip()
    publishable_key = str(request.data.get("publishable_key", "")).strip()
    if not secret_key or not publishable_key:
        return Response({"detail": "Paste both your restricted key and your publishable key."}, status=status.HTTP_400_BAD_REQUEST)

    # Stripe keys say what they are in their first letters, so a wrong paste is caught before we even call Stripe.
    if not secret_key.startswith(("rk_", "sk_")) or not publishable_key.startswith("pk_"):
        return Response(
            {"detail": "Those don't look like Stripe keys. Restricted keys start with rk_ and publishable keys start with pk_."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Test keys say "test" in them. Both keys have to be from the same mode, so a live key
    # can't end up paired with a test key.
    mode = "test" if secret_key.startswith(("rk_test_", "sk_test_")) else "live"
    publishable_mode = "test" if publishable_key.startswith("pk_test_") else "live"
    if mode != publishable_mode:
        return Response(
            {"detail": "Use keys from the same mode. Both should be test keys, or both should be live keys."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        stripe_api.check_key(secret_key)
    except StripeError as exc:
        if exc.status == 401:
            detail = "Stripe didn't accept that key. Check you copied the whole key."
        elif exc.status == 403:
            detail = "That key can't read payments. Give it permission to read and write payments in Stripe, then try again."
        else:
            detail = exc.message
        return Response({"detail": detail}, status=status.HTTP_502_BAD_GATEWAY if exc.status == 0 else status.HTTP_400_BAD_REQUEST)

    connection, _ = IntegrationConnection.objects.update_or_create(
        business_account=request.user,
        integration=entry["key"],
        defaults={
            "secrets": encrypt_secrets({"secret_key": secret_key, "publishable_key": publishable_key}),
            "options": {"mode": mode},
            "status": IntegrationConnection.STATUS_CONNECTED,
            "last_error": "",
        },
    )
    return Response(_summary(entry, request.user, _owned_keys(request.user), connection), status=status.HTTP_201_CREATED)


class IntegrationDisconnectView(APIView):
    """DELETE /api/integrations/<key>/ — disconnect. Events already on the calendar stay where they are."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, key):
        connection = IntegrationConnection.objects.for_account(request.user).filter(integration=key).first()
        if connection is None:
            return Response({"detail": "That one isn't connected."}, status=status.HTTP_404_NOT_FOUND)
        connection.delete()
        return Response({"detail": "Disconnected. Events already on your calendar stay there."})
