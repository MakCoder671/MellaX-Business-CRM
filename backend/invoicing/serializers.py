from decimal import Decimal

from django.db import models, transaction
from rest_framework import serializers

from clients.models import Client
from scheduling.models import Appointment
from services.models import Service

from .models import Discount, Invoice, InvoiceLineItem, PaymentRecord, TenderType

# ----------------------------------------------------------------------------
# This is the busiest file in the backend — it's where the actual money
# math happens: calculating tax, auto-numbering invoices, and flipping an
# invoice's status to "paid" once enough has been paid on it.
# ----------------------------------------------------------------------------


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    """One row of an invoice — "2x Lawn Maintenance @ $75"."""

    # Computed, not stored — quantity x unit_price, minus this line's own
    # discount if it has one. Sent back so the frontend never has to
    # reimplement the discount math itself just to show a line's total.
    net_amount = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceLineItem
        fields = [
            "id",
            "service",
            "quantity",
            "unit_price",
            "discount_type",
            "discount_value",
            "is_refund_line",
            "net_amount",
            "is_voided",
            "void_note",
        ]
        # unit_price is read-only on purpose — per Mako, prices are
        # "locked": whatever's on the invoice always comes straight from
        # Service.price at the moment the line was added, never a
        # hand-typed number. The only way to change what a line actually
        # costs is discount_type/discount_value — a one-off amount typed
        # in on the spot (see InvoiceSerializer._build_line_item, which
        # is what actually fills unit_price in). is_voided/void_note are
        # also read-only here — they only ever get set through the
        # dedicated add_line_item()/void_line_item() actions on
        # InvoiceViewSet, which is what keeps every change to a line item
        # traceable (see the note on InvoiceLineItem.is_voided).
        read_only_fields = ["id", "unit_price", "net_amount", "is_voided", "void_note"]

    def get_net_amount(self, obj):
        return obj.net_amount()


class PaymentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRecord
        fields = [
            "id",
            "client",
            "invoice",
            "tender_type",
            "amount",
            "date_received",
            "is_refund",
        ]
        read_only_fields = ["id", "date_received"]

    def validate(self, attrs):
        # Belt-and-suspenders check: even though the frontend should only
        # ever show this account's own clients/invoices/tender-types in
        # its dropdowns, we double-check here on the server that the IDs
        # someone submitted actually belong to them. Never trust the
        # frontend alone — someone could always call the API directly.
        #
        # `.get(...) or getattr(self.instance, ...)` handles a PARTIAL
        # update too (e.g. "Edit Tender Type" on an existing payment only
        # sends tender_type) — falls back to what the row already has for
        # anything that wasn't resent, same pattern scheduling's
        # AppointmentSerializer uses.
        account = self.context["request"].user

        client = attrs.get("client") or getattr(self.instance, "client", None)
        invoice = attrs.get("invoice") or getattr(self.instance, "invoice", None)
        tender_type = attrs.get("tender_type") or getattr(self.instance, "tender_type", None)

        if client and not Client.objects.for_account(account).filter(pk=client.pk).exists():
            raise serializers.ValidationError({"client": "Client not found."})

        if invoice:
            owned_invoice = Invoice.objects.for_account(account).filter(pk=invoice.pk).first()
            if owned_invoice is None:
                raise serializers.ValidationError({"invoice": "Invoice not found."})
            if owned_invoice.is_locked():
                raise serializers.ValidationError("This invoice has been voided and can't be changed.")
            if owned_invoice.status == Invoice.STATUS_QUOTE:
                raise serializers.ValidationError(
                    "This is a quote, not a real invoice yet. No payment can be recorded against it."
                )

        # Tender types are a bit different — a tender type either belongs
        # to nobody (a system default like "Cash") or belongs to exactly
        # this account (a custom one they added). Anything else means it's
        # someone ELSE's custom tender type, which shouldn't be usable here.
        if tender_type and tender_type.business_account_id not in (None, account.pk):
            raise serializers.ValidationError({"tender_type": "Tender type not found."})

        return attrs

    def create(self, validated_data):
        # After actually saving the payment row, we check whether the
        # invoice should flip to "paid" or "refunded" — this is the bit
        # of logic that makes the invoice's status reflect reality instead
        # of needing someone to manually mark it paid.
        payment = super().create(validated_data)
        invoice = payment.invoice

        if payment.is_refund:
            invoice.status = Invoice.STATUS_REFUNDED
        else:
            # Add up everything paid so far, minus anything refunded so far.
            paid = invoice.payment_records.filter(is_refund=False).aggregate(
                total=models.Sum("amount")
            )["total"] or Decimal("0")
            refunded = invoice.payment_records.filter(is_refund=True).aggregate(
                total=models.Sum("amount")
            )["total"] or Decimal("0")

            if paid - refunded >= invoice.total_due():
                invoice.status = Invoice.STATUS_PAID

        invoice.save(update_fields=["status"])
        return payment


class InvoiceSerializer(serializers.ModelSerializer):
    # `many=True` because an invoice has MULTIPLE line items — this nests
    # the whole InvoiceLineItemSerializer's fields as a list inside the
    # invoice JSON, e.g. { ..., "line_items": [{...}, {...}] }
    line_items = InvoiceLineItemSerializer(many=True)
    payment_records = PaymentRecordSerializer(many=True, read_only=True)  # shown when reading, but you don't create payments through this serializer — see invoicing/views.py's PaymentRecordViewSet for that

    # Computed straight from Invoice's own methods (invoicing/models.py)
    # — sent back so the frontend has ONE source of truth for "what does
    # this invoice actually add up to" instead of re-deriving the
    # discount/tax math itself and risking it drifting out of sync.
    subtotal = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    total_due = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            "id",
            "client",
            "appointment",
            "discount",
            "tax_amount",
            "subtotal",
            "discount_amount",
            "total_due",
            "notes",
            "status",
            "invoice_number",
            "issued_date",
            "created_at",
            "line_items",
            "payment_records",
        ]
        # All of these get calculated/assigned by our own code below, not
        # sent by the frontend — e.g. you don't get to pick your own
        # invoice number or set your own tax amount. "status" is a
        # partial exception — see validate_status() below: it's settable
        # at creation (to choose "quote" vs a real invoice) but locked
        # after that.
        read_only_fields = ["id", "tax_amount", "invoice_number", "issued_date", "created_at"]

    def get_subtotal(self, obj):
        return obj.subtotal()

    def get_discount_amount(self, obj):
        return obj.discount_amount()

    def get_total_due(self, obj):
        return obj.total_due()

    def validate_client(self, client):
        # Same "don't trust the frontend" check as PaymentRecordSerializer above.
        account = self.context["request"].user
        if not Client.objects.for_account(account).filter(pk=client.pk).exists():
            raise serializers.ValidationError("Client not found.")
        return client

    def validate_appointment(self, appointment):
        # Set only when this invoice is being created FROM the client
        # profile's Appointments tab ("Create invoice" on a specific,
        # not-yet-invoiced appointment) — same ownership check as client.
        if appointment is None:
            return appointment
        account = self.context["request"].user
        if not Appointment.objects.for_account(account).filter(pk=appointment.pk).exists():
            raise serializers.ValidationError("Appointment not found.")
        return appointment

    def validate_discount(self, discount):
        # The invoice-wide discount (applies to the whole total — see
        # Invoice.discount_amount() in invoicing/models.py). Per-line
        # discounts are checked in validate_line_items below.
        if discount is None:
            return discount
        account = self.context["request"].user
        if not Discount.objects.for_account(account).filter(pk=discount.pk).exists():
            raise serializers.ValidationError("Discount not found.")
        return discount

    def validate_status(self, status):
        if self.instance is not None:
            # Status changes only ever happen through a dedicated flow —
            # recording a payment (PaymentRecordSerializer.create() flips
            # it to paid/refunded automatically) or voiding
            # (InvoiceViewSet.void()) — never a plain PATCH through here,
            # so nothing can quietly un-void or skip the payment flow.
            if status != self.instance.status:
                raise serializers.ValidationError("Invoice status can't be changed directly.")
            return status
        # A brand new invoice can only start as a real (unpaid) invoice
        # or a quote — "paid"/"refunded" only ever happen by actually
        # recording a payment, and "void" only through the void action.
        if status not in (Invoice.STATUS_UNPAID, Invoice.STATUS_QUOTE):
            raise serializers.ValidationError("A new invoice must start as unpaid or a quote.")
        return status

    def validate_line_items(self, line_items):
        if not line_items:
            raise serializers.ValidationError("An invoice needs at least one line item.")

        account = self.context["request"].user
        service_ids = {item["service"].pk for item in line_items}
        owned_service_ids = set(
            Service.objects.for_account(account).filter(pk__in=service_ids).values_list("pk", flat=True)
        )
        if service_ids - owned_service_ids:
            # If any requested service ID ISN'T in this account's own
            # services, that's a "not found" (or someone trying to use
            # another account's service).
            raise serializers.ValidationError("One or more services were not found.")

        for item in line_items:
            value = item.get("discount_value")
            if value and item.get("discount_type") == InvoiceLineItem.DISCOUNT_TYPE_PERCENT and value > 100:
                raise serializers.ValidationError("A percent discount on a line item can't be more than 100%.")

        return line_items

    def validate(self, attrs):
        if self.instance is not None and self.instance.is_locked():
            raise serializers.ValidationError("This invoice has been voided and can't be changed.")
        # Per Mako: nothing about a line item gets changed through a
        # plain PATCH anymore — every add/edit/remove goes through
        # InvoiceViewSet's add_line_item()/void_line_item() actions
        # instead, so old values stay in the record (crossed out, with a
        # note) instead of just being silently overwritten.
        if self.instance is not None and "line_items" in attrs:
            raise serializers.ValidationError(
                "Line items can't be changed this way anymore. Use the line item endpoints instead."
            )
        return attrs

    def _line_net(self, item):
        # Mirrors InvoiceLineItem.net_amount() (invoicing/models.py), but
        # operating on a plain validated-data dict since these line items
        # haven't been saved as real rows yet at the point tax gets
        # computed (both on create AND on update, where the whole set of
        # line items gets rebuilt from scratch).
        gross = item["quantity"] * item["service"].price
        value = item.get("discount_value")
        if not value:
            return gross
        if item.get("discount_type") == InvoiceLineItem.DISCOUNT_TYPE_FLAT:
            return gross - min(value, gross)
        return gross - (gross * value / Decimal("100"))

    def _compute_tax(self, account, line_items):
        # Walks every line item and, for the taxable ones, adds
        # (net amount x tax%) to the running total — "net" meaning AFTER
        # that line's own discount, if it has one, so a discounted
        # service isn't taxed as if it sold at full price. The tax
        # percentage itself comes from the account's own Invoice Settings
        # (service_tax_percent), which the business configures once.
        total = Decimal("0")
        for item in line_items:
            if item["service"].is_taxable:
                total += self._line_net(item) * (account.service_tax_percent / Decimal("100"))
        # Rounded to the cent — see the note on Invoice.total_due() for
        # why an un-rounded fractional-cent total is a real bug, not just
        # a cosmetic one.
        return total.quantize(Decimal("0.01"))

    def _build_line_item(self, invoice, item):
        # Prices are locked (see InvoiceLineItemSerializer above) — the
        # unit price is never taken from the request, always looked up
        # fresh from the service itself at the moment the line is built.
        return InvoiceLineItem(invoice=invoice, unit_price=item["service"].price, **item)

    def _next_invoice_number(self, account):
        # Every account has its own running counter (next_invoice_sequence,
        # starting at 1001) plus a prefix (default "INV-"), so invoice
        # numbers look like "INV-1001", "INV-1002", etc, and each business
        # has its own independent sequence.
        number = f"{account.invoice_prefix}{account.next_invoice_sequence}"
        account.next_invoice_sequence += 1
        account.save(update_fields=["next_invoice_sequence"])
        return number

    @transaction.atomic  # if anything below fails partway through, the whole thing rolls back — no half-created invoices
    def create(self, validated_data):
        account = self.context["request"].user
        line_items_data = validated_data.pop("line_items")

        invoice = Invoice.objects.create(
            business_account=account,
            invoice_number=self._next_invoice_number(account),
            tax_amount=self._compute_tax(account, line_items_data),
            **validated_data,
        )

        # bulk_create makes one efficient database query for all the line
        # items instead of one query per line item.
        InvoiceLineItem.objects.bulk_create(
            [self._build_line_item(invoice, item) for item in line_items_data]
        )
        return invoice

    def update(self, instance, validated_data):
        # Line items are never touched here anymore (validate() above
        # rejects a PATCH that tries) — this is left for the small stuff
        # that's still fine to just overwrite directly: notes, the
        # invoice-wide discount, and so on.
        validated_data.pop("line_items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class TenderTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenderType
        fields = ["id", "name", "is_custom"]
        read_only_fields = ["id"]


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = ["id", "name", "type", "amount", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
