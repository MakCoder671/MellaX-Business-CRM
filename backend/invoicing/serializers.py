from decimal import Decimal

from django.db import models, transaction
from rest_framework import serializers

from clients.models import Client
from services.models import Service

from .models import Discount, Invoice, InvoiceLineItem, PaymentRecord, TenderType


class InvoiceLineItemSerializer(serializers.ModelSerializer):
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
        account = self.context["request"].user
        if not Client.objects.for_account(account).filter(pk=attrs["client"].pk).exists():
            raise serializers.ValidationError({"client": "Client not found."})
        if not Invoice.objects.for_account(account).filter(pk=attrs["invoice"].pk).exists():
            raise serializers.ValidationError({"invoice": "Invoice not found."})
        tender_type = attrs["tender_type"]
        if tender_type.business_account_id not in (None, account.pk):
            raise serializers.ValidationError({"tender_type": "Tender type not found."})
        return attrs

    def create(self, validated_data):
        payment = super().create(validated_data)
        invoice = payment.invoice
        if payment.is_refund:
            invoice.status = Invoice.STATUS_REFUNDED
        else:
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
    line_items = InvoiceLineItemSerializer(many=True)
    payment_records = PaymentRecordSerializer(many=True, read_only=True)

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
        read_only_fields = ["id", "tax_amount", "status", "invoice_number", "issued_date"]

    def validate_client(self, client):
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
            raise serializers.ValidationError("One or more services were not found.")
        return line_items

    def _compute_tax(self, account, line_items):
        total = Decimal("0")
        for item in line_items:
            if item["service"].is_taxable:
                total += item["unit_price"] * item["quantity"] * (
                    account.service_tax_percent / Decimal("100")
                )
        return total

    def _next_invoice_number(self, account):
        number = f"{account.invoice_prefix}{account.next_invoice_sequence}"
        account.next_invoice_sequence += 1
        account.save(update_fields=["next_invoice_sequence"])
        return number

    @transaction.atomic
    def create(self, validated_data):
        account = self.context["request"].user
        line_items_data = validated_data.pop("line_items")
        invoice = Invoice.objects.create(
            business_account=account,
            invoice_number=self._next_invoice_number(account),
            tax_amount=self._compute_tax(account, line_items_data),
            **validated_data,
        )
        InvoiceLineItem.objects.bulk_create(
            [InvoiceLineItem(invoice=invoice, **item) for item in line_items_data]
        )
        return invoice

    @transaction.atomic
    def update(self, instance, validated_data):
        """An invoice stays editable after creation (business_plan.MD, Basic
        Plan): incoming line items replace the set, a refund is just a new
        line item with is_refund_line=True rather than erasing history."""
        line_items_data = validated_data.pop("line_items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if line_items_data is not None:
            account = self.context["request"].user
            instance.tax_amount = self._compute_tax(account, line_items_data)
            instance.line_items.all().delete()
            InvoiceLineItem.objects.bulk_create(
                [InvoiceLineItem(invoice=instance, **item) for item in line_items_data]
            )
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
