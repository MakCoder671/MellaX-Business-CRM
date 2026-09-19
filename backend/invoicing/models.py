from decimal import Decimal

from django.db import models

from common.models import TenantScopedModel


class TenderType(models.Model):
    """How a payment was received (Cash, Visa, etc).

    business_account is nullable: null rows are system-wide defaults shown
    to every account, non-null rows are an account's own custom additions.
    """

    business_account = models.ForeignKey(
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,
        related_name="tender_types",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    is_custom = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class Discount(TenantScopedModel):
    TYPE_FLAT = "flat"
    TYPE_PERCENT = "percent"
    TYPE_CHOICES = [(TYPE_FLAT, "Flat"), (TYPE_PERCENT, "Percent")]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return self.name


class Invoice(TenantScopedModel):
    STATUS_UNPAID = "unpaid"
    STATUS_PAID = "paid"
    STATUS_REFUNDED = "refunded"
    STATUS_CHOICES = [
        (STATUS_UNPAID, "Unpaid"),
        (STATUS_PAID, "Paid"),
        (STATUS_REFUNDED, "Refunded"),
    ]

    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="invoices")
    discount = models.ForeignKey(Discount, on_delete=models.SET_NULL, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_UNPAID)
    invoice_number = models.CharField(max_length=32)
    issued_date = models.DateField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["business_account", "invoice_number"],
                name="unique_invoice_number_per_account",
            )
        ]

    def __str__(self):
        return self.invoice_number

    def total_due(self):
        line_total = sum(
            (item.quantity * item.unit_price for item in self.line_items.all()),
            Decimal("0"),
        )
        return line_total + self.tax_amount


class InvoiceLineItem(models.Model):
    """A Service (see services.Service) or product performed/sold on an invoice.

    No separate Product model exists in v1 — Basic Plan's "Services" already
    covers physical items (e.g. "10x10 Deck Build"), so one catalog FK
    covers both rather than two FKs pointed at the same table.
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="line_items")
    service = models.ForeignKey("services.Service", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_refund_line = models.BooleanField(default=False)


class PaymentRecord(TenantScopedModel):
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="payment_records")
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payment_records")
    tender_type = models.ForeignKey(TenderType, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date_received = models.DateField(auto_now_add=True)
    is_refund = models.BooleanField(default=False)
