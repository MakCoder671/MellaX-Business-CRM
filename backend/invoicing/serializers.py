from decimal import Decimal

from django.db import models, transaction
from rest_framework import serializers

from clients.models import Client
from services.models import Service

from .models import Discount, Invoice, InvoiceLineItem, PaymentRecord, TenderType

# ----------------------------------------------------------------------------
# This is the busiest file in the backend — it's where the actual money
# math happens: calculating tax, auto-numbering invoices, and flipping an
# invoice's status to "paid" once enough has been paid on it.
# ----------------------------------------------------------------------------


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    """One row of an invoice — "2x Lawn Maintenance @ $75"."""

    class Meta:
        model = InvoiceLineItem
        fields = ["id", "service", "quantity", "unit_price", "is_refund_line"]
        read_only_fields = ["id"]


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
        account = self.context["request"].user

        if not Client.objects.for_account(account).filter(pk=attrs["client"].pk).exists():
            raise serializers.ValidationError({"client": "Client not found."})

        if not Invoice.objects.for_account(account).filter(pk=attrs["invoice"].pk).exists():
            raise serializers.ValidationError({"invoice": "Invoice not found."})

        # Tender types are a bit different — a tender type either belongs
        # to nobody (a system default like "Cash") or belongs to exactly
        # this account (a custom one they added). Anything else means it's
        # someone ELSE's custom tender type, which shouldn't be usable here.
        tender_type = attrs["tender_type"]
        if tender_type.business_account_id not in (None, account.pk):
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

    class Meta:
        model = Invoice
        fields = [
            "id",
            "client",
            "discount",
            "tax_amount",
            "notes",
            "status",
            "invoice_number",
            "issued_date",
            "line_items",
            "payment_records",
        ]
        # All of these get calculated/assigned by our own code below, not
        # sent by the frontend — e.g. you don't get to pick your own
        # invoice number or set your own tax amount.
        read_only_fields = ["id", "tax_amount", "status", "invoice_number", "issued_date"]

    def validate_client(self, client):
        # Same "don't trust the frontend" check as PaymentRecordSerializer above.
        account = self.context["request"].user
        if not Client.objects.for_account(account).filter(pk=client.pk).exists():
            raise serializers.ValidationError("Client not found.")
        return client

    def validate_line_items(self, line_items):
        if not line_items:
            raise serializers.ValidationError("An invoice needs at least one line item.")

        account = self.context["request"].user
        service_ids = {item["service"].pk for item in line_items}
        owned_ids = set(
            Service.objects.for_account(account).filter(pk__in=service_ids).values_list("pk", flat=True)
        )
        if service_ids - owned_ids:
            # If any requested service ID ISN'T in this account's own
            # services, that's a "not found" (or someone trying to use
            # another account's service).
            raise serializers.ValidationError("One or more services were not found.")

        return line_items

    def _compute_tax(self, account, line_items):
        # Walks every line item and, for the taxable ones, adds
        # (price x quantity x tax%) to the running total. The tax
        # percentage itself comes from the account's own Invoice Settings
        # (service_tax_percent), which the business configures once.
        total = Decimal("0")
        for item in line_items:
            if item["service"].is_taxable:
                total += item["unit_price"] * item["quantity"] * (
                    account.service_tax_percent / Decimal("100")
                )
        return total

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
            [InvoiceLineItem(invoice=invoice, **item) for item in line_items_data]
        )
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Per the plan doc: "an invoice stays editable after creation" — you
        can add a note, tweak a line item, or add a refund line, and it
        should still reflect what actually happened rather than being
        locked in stone. This handles that: if new line_items were sent,
        we swap out the old set entirely and recompute tax to match.
        """
        line_items_data = validated_data.pop("line_items", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if line_items_data is not None:
            account = self.context["request"].user
            instance.tax_amount = self._compute_tax(account, line_items_data)
            instance.line_items.all().delete()  # wipe the old rows...
            InvoiceLineItem.objects.bulk_create(
                [InvoiceLineItem(invoice=instance, **item) for item in line_items_data]
            )  # ...and replace them with the new set

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
