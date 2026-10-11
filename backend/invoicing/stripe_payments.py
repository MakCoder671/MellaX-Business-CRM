from decimal import Decimal

from rest_framework.exceptions import ValidationError

# ----------------------------------------------------------------------------
# Card payments through the owner's own Stripe account. The money goes straight
# to their Stripe account, and MellaX only records what Stripe reports. Card
# numbers are typed into Stripe's own secure form, so they never reach MellaX.
# ----------------------------------------------------------------------------

NOT_CONNECTED = "Connect Stripe in Integrations first. Card payments go through your Stripe account."


def stripe_keys(account):
    from integrations.crypto import decrypt_secrets
    from integrations.models import IntegrationConnection

    connection = IntegrationConnection.objects.filter(
        business_account=account, integration="stripe", status__in=["connected", "error"]
    ).first()
    if connection is None:
        raise ValidationError({"detail": NOT_CONNECTED})
    secrets = decrypt_secrets(connection.secrets)
    return {
        "secret": secrets["secret_key"],
        "publishable": secrets["publishable_key"],
        "mode": connection.options.get("mode", "test"),
    }


def to_cents(amount):
    return int((Decimal(amount) * 100).quantize(Decimal("1")))


def _request(keys, method, path, params=None):
    from integrations import stripe_api

    try:
        return stripe_api.request(keys["secret"], method, path, params)
    except stripe_api.StripeError as exc:
        raise ValidationError({"detail": exc.message}) from exc


def create_intent(keys, invoice, amount):
    return _request(keys, "POST", "payment_intents", {
        "amount": to_cents(amount),
        "currency": "usd",
        "automatic_payment_methods[enabled]": "true",
        "description": f"Invoice {invoice.invoice_number}",
        "metadata[invoice_number]": invoice.invoice_number,
        "metadata[mellax_invoice_id]": str(invoice.pk),
    })


def retrieve_intent(keys, intent_id):
    return _request(keys, "GET", f"payment_intents/{intent_id}", {"expand[]": "latest_charge"})


def cancel_intent(keys, intent_id):
    return _request(keys, "POST", f"payment_intents/{intent_id}/cancel")


def refund_intent(keys, intent_id, amount):
    return _request(keys, "POST", "refunds", {"payment_intent": intent_id, "amount": to_cents(amount)})


def card_details(intent):
    """The card type and last 4 digits, from the charge Stripe made for this payment."""
    charge = intent.get("latest_charge") or {}
    if not isinstance(charge, dict):
        return "", ""
    card = (charge.get("payment_method_details") or {}).get("card") or {}
    return (card.get("brand") or "").lower(), card.get("last4") or ""
