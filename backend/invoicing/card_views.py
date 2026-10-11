from decimal import Decimal
from types import SimpleNamespace

from django.db import models
from rest_framework import permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsPlusOrAbove

from .models import Discount, Invoice, PaymentRecord, TenderType
from .serializers import PaymentRecordSerializer
from .stripe_payments import (
    cancel_intent,
    card_details,
    create_intent,
    refund_intent,
    retrieve_intent,
    stripe_keys,
)

# ----------------------------------------------------------------------------
# Card payments: start a payment, confirm it after Stripe approves it, and send
# refunds back through Stripe. Plus accounts only.
# ----------------------------------------------------------------------------

CARD_TENDERS = {"visa": "Visa", "mastercard": "Mastercard", "amex": "Amex", "discover": "Discover"}


def _card_tender(account, brand):
    name = CARD_TENDERS.get(brand)
    if name:
        return TenderType.objects.get(business_account=None, name=name)
    # A card type we don't list by name still gets recorded, under "Card".
    tender, _ = TenderType.objects.get_or_create(business_account=account, name="Card", defaults={"is_custom": True})
    return tender


def _record_card_payment(invoice, intent):
    """
    Saves a succeeded Stripe payment intent as a real PaymentRecord, unless it's already
    saved (checking twice is harmless). Shared by the confirm endpoint, called right after
    the browser sees Stripe approve a card, and reconcile_pending_card_payment below, which
    catches it later if we never heard back from the browser at all.
    """
    existing = PaymentRecord.objects.filter(processor_intent=intent["id"]).first()
    if existing is not None:
        return existing
    account = invoice.business_account
    brand, last4 = card_details(intent)
    amount = Decimal(intent["amount_received"]) / Decimal("100")
    # PaymentRecordSerializer.validate() only needs `.user` off whatever's in "request" —
    # there's no real request here, so a tiny stand-in object is all it needs.
    serializer = PaymentRecordSerializer(
        data={
            "client": invoice.client_id,
            "invoice": invoice.pk,
            "tender_type": _card_tender(account, brand).pk,
            "amount": f"{amount:.2f}",
            "is_refund": False,
        },
        context={"request": SimpleNamespace(user=account)},
    )
    serializer.is_valid(raise_exception=True)
    payment = serializer.save(business_account=account)
    PaymentRecord.objects.filter(pk=payment.pk).update(
        processor="stripe", processor_intent=intent["id"], card_brand=brand, card_last4=last4,
    )
    payment.refresh_from_db()
    return payment


def reconcile_pending_card_payment(invoice):
    """
    Asks Stripe directly about a card payment this invoice is still waiting on. This covers
    the rare case where the card actually went through, but the browser never told us (the
    tab closed, or the connection dropped, right as Stripe approved it) — without needing a
    webhook, which would mean the owner setting one up in their own Stripe dashboard.
    Called quietly whenever the invoice is opened (see InvoiceViewSet.retrieve). Never raises
    — a Stripe hiccup here should never stop someone from just looking at an invoice.
    """
    if not invoice.pending_payment_intent:
        return
    try:
        keys = stripe_keys(invoice.business_account)
        intent = retrieve_intent(keys, invoice.pending_payment_intent)
    except Exception:
        return
    status = intent.get("status")
    if status == "succeeded":
        _record_card_payment(invoice, intent)
        invoice.pending_payment_intent = ""
        invoice.save(update_fields=["pending_payment_intent"])
    elif status == "canceled":
        # Never went through - clear the flag so a fresh charge can start clean next time.
        invoice.pending_payment_intent = ""
        invoice.save(update_fields=["pending_payment_intent"])


def _paid_net(invoice):
    received = invoice.payment_records.filter(is_refund=False).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
    refunded = invoice.payment_records.filter(is_refund=True).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
    return received - refunded


class StripeConfigView(APIView):
    """GET /api/invoicing/stripe/config/ — what the card form needs to know. Never the secret key."""

    permission_classes = [permissions.IsAuthenticated, IsPlusOrAbove]

    def get(self, request):
        keys = stripe_keys(request.user)
        return Response({"publishable_key": keys["publishable"], "mode": keys["mode"]})


class InvoiceCardPaymentView(APIView):
    """POST /api/invoicing/invoices/<id>/card-payment/ — starts a card payment for part or all of the balance."""

    permission_classes = [permissions.IsAuthenticated, IsPlusOrAbove]

    def post(self, request, pk):
        invoice = Invoice.objects.for_account(request.user).filter(pk=pk).first()
        if invoice is None:
            raise ValidationError({"detail": "Invoice not found."})
        if invoice.is_locked() or invoice.status in (Invoice.STATUS_QUOTE, Invoice.STATUS_VOID):
            raise ValidationError({"detail": "This invoice can't take a card payment."})

        try:
            amount = Decimal(str(request.data.get("amount", "")))
        except Exception as exc:
            raise ValidationError({"amount": "Enter the amount to charge."}) from exc
        remaining = invoice.total_due() - _paid_net(invoice)
        if remaining <= 0:
            raise ValidationError({"amount": "This invoice is already paid in full."})
        if amount <= 0:
            raise ValidationError({"amount": "The amount needs to be more than zero."})
        if amount > remaining:
            raise ValidationError({"amount": f"That's more than the balance due. ${remaining:.2f} is left on this invoice."})

        keys = stripe_keys(request.user)
        if invoice.pending_payment_intent:
            # Starting a new charge cancels any earlier one that never went through.
            try:
                cancel_intent(keys, invoice.pending_payment_intent)
            except ValidationError:
                pass
        intent = create_intent(keys, invoice, amount)
        invoice.pending_payment_intent = intent["id"]
        invoice.save(update_fields=["pending_payment_intent"])
        return Response({
            "payment_intent_id": intent["id"],
            "client_secret": intent["client_secret"],
            "publishable_key": keys["publishable"],
            "amount": f"{amount:.2f}",
        }, status=201)


class InvoiceCardPaymentConfirmView(APIView):
    """
    POST /api/invoicing/invoices/<id>/card-payment/confirm/ — called after the card is approved.
    Checks with Stripe, then records the payment with the card type and last 4 digits.
    """

    permission_classes = [permissions.IsAuthenticated, IsPlusOrAbove]

    def post(self, request, pk):
        invoice = Invoice.objects.for_account(request.user).filter(pk=pk).first()
        if invoice is None:
            raise ValidationError({"detail": "Invoice not found."})
        intent_id = str(request.data.get("payment_intent_id", ""))
        if not intent_id or intent_id != invoice.pending_payment_intent:
            raise ValidationError({"detail": "That payment isn't waiting for this invoice."})

        keys = stripe_keys(request.user)
        intent = retrieve_intent(keys, intent_id)
        if intent.get("status") != "succeeded":
            raise ValidationError({"detail": "The card payment hasn't gone through yet. Try again or use another card."})

        # Confirming twice is harmless: the second time, the payment is already recorded.
        payment = _record_card_payment(invoice, intent)
        invoice.pending_payment_intent = ""
        invoice.save(update_fields=["pending_payment_intent"])
        return Response(PaymentRecordSerializer(payment).data, status=201)


class PaymentRefundView(APIView):
    """POST /api/invoicing/payments/<id>/stripe-refund/ — sends money back to the customer's card through Stripe."""

    permission_classes = [permissions.IsAuthenticated, IsPlusOrAbove]

    def post(self, request, pk):
        payment = PaymentRecord.objects.for_account(request.user).filter(pk=pk).first()
        if payment is None:
            raise ValidationError({"detail": "Payment not found."})
        if payment.processor != "stripe" or payment.is_refund:
            raise ValidationError({"detail": "Only a card payment taken through Stripe can be refunded here. Record any other refund by hand."})
        if payment.invoice.is_locked():
            raise ValidationError({"detail": "This invoice is voided, so its payments can't be refunded."})

        already = PaymentRecord.objects.filter(processor_intent=payment.processor_intent, is_refund=True).aggregate(total=models.Sum("amount"))["total"] or Decimal("0")
        refundable = payment.amount - already
        if refundable <= 0:
            raise ValidationError({"detail": "This payment has already been fully refunded."})
        raw = request.data.get("amount")
        amount = refundable if raw in (None, "") else Decimal(str(raw))
        if amount <= 0:
            raise ValidationError({"amount": "The refund needs to be more than zero."})
        if amount > refundable:
            raise ValidationError({"amount": f"Only ${refundable:.2f} can still be refunded on this payment."})

        keys = stripe_keys(request.user)
        refund = refund_intent(keys, payment.processor_intent, amount)
        serializer = PaymentRecordSerializer(
            data={"client": payment.client_id, "invoice": payment.invoice_id, "tender_type": payment.tender_type_id, "amount": f"{amount:.2f}", "is_refund": True},
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        refund_record = serializer.save(business_account=request.user)
        PaymentRecord.objects.filter(pk=refund_record.pk).update(
            processor="stripe", processor_intent=payment.processor_intent, processor_reference=refund["id"],
            card_brand=payment.card_brand, card_last4=payment.card_last4,
        )
        refund_record.refresh_from_db()
        return Response(PaymentRecordSerializer(refund_record).data, status=201)
