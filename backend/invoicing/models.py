from decimal import Decimal

from django.db import models

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# This is the heart of the app — the "Client -> Invoice -> Payment
# Recorded -> Invoice Finalized -> Report" loop from the plan doc. Five
# models here, roughly in the order money flows through them:
#
#   TenderType  -- how a payment was received (Cash, Visa, etc)
#   Discount    -- a reusable discount a business can apply to an invoice
#   Invoice     -- the bill itself
#   InvoiceLineItem -- one row on an invoice ("2x Lawn Maintenance @ $75")
#   PaymentRecord   -- "this invoice got paid $150 in cash on this date"
# ----------------------------------------------------------------------------


class TenderType(models.Model):
    """
    How a payment was received — Cash, Visa, Mastercard, a custom one a
    business adds themselves, etc.

    This one does NOT inherit from TenantScopedModel like the others,
    because business_account needs to be allowed to be blank: rows with
    business_account=None are the system-wide defaults (Cash, Visa, ...)
    that every account sees, while rows with an actual business_account
    are that one business's own custom addition.
    """

    business_account = models.ForeignKey(
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,
        related_name="tender_types",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    is_custom = models.BooleanField(default=False)  # False = one of our pre-loaded defaults, True = a business added it themselves

    def __str__(self):
        return self.name


class Discount(TenantScopedModel):
    """A reusable discount a business can create once and apply to many invoices."""

    TYPE_FLAT = "flat"
    TYPE_PERCENT = "percent"
    TYPE_CHOICES = [(TYPE_FLAT, "Flat"), (TYPE_PERCENT, "Percent")]

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # either a dollar amount or a percentage, depending on `type`

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

    # PROTECT means: Django will refuse to delete a Client or Service if
    # there's still an invoice pointing at it. That's intentional — you
    # don't want deleting a client to silently wipe out their invoice
    # history. (This is also why the Settings doc talks about "archiving"
    # a client instead of deleting them.)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="invoices")
    discount = models.ForeignKey(Discount, on_delete=models.SET_NULL, null=True, blank=True)

    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # calculated automatically, see serializers.py
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_UNPAID)
    invoice_number = models.CharField(max_length=32)  # e.g. "INV-1001", auto-generated — see serializers.py
    issued_date = models.DateField(auto_now_add=True)

    class Meta:
        constraints = [
            # Makes sure two invoices under the SAME business can't both be
            # "INV-1001" — but two different businesses can each have their
            # own "INV-1001" without conflicting, since the uniqueness check
            # includes business_account.
            models.UniqueConstraint(
                fields=["business_account", "invoice_number"],
                name="unique_invoice_number_per_account",
            )
        ]

    def __str__(self):
        return self.invoice_number

    def total_due(self):
        # Adds up every line item's (quantity x unit_price), plus tax.
        # This is a plain Python method (not a database field) — it gets
        # recalculated on the fly whenever something calls invoice.total_due(),
        # so it's always accurate even if line items changed after the
        # invoice was created.
        line_total = sum(
            (item.quantity * item.unit_price for item in self.line_items.all()),
            Decimal("0"),  # start the sum at Decimal(0) instead of int 0, so the math stays Decimal-typed throughout
        )
        return line_total + self.tax_amount


class InvoiceLineItem(models.Model):
    """
    One row on an invoice — e.g. "2x Lawn Maintenance at $75 each."
    An invoice usually has several of these.
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="line_items")
    service = models.ForeignKey("services.Service", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)  # captured at the time of the invoice — if the Service's price changes later, old invoices stay correct
    is_refund_line = models.BooleanField(default=False)  # True marks this row as a refund added after the fact, not part of the original sale


class PaymentRecord(TenantScopedModel):
    """
    A record that money changed hands for an invoice. Note the name —
    MellaX *records* that a payment happened, it doesn't actually process
    credit cards or move money itself (that's what the "Merchant
    Provider Integration" Plus feature is for, using a real payment
    processor).
    """

    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="payment_records")
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payment_records")
    tender_type = models.ForeignKey(TenderType, on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date_received = models.DateField(auto_now_add=True)
    is_refund = models.BooleanField(default=False)  # True = money going back OUT to the client, not coming in
