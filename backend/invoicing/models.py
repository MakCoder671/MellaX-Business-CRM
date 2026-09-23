from datetime import timedelta
from decimal import Decimal

from django.db import models
from django.utils import timezone

from common.models import TenantScopedModel

CENTS = Decimal("0.01")  # every money total gets rounded to this before it's compared or displayed — see the note on Invoice.total_due()

# How long an invoice can be deleted outright before it locks instead —
# see Invoice.is_locked() and sync_void_status() below, plus the
# "void_expired_invoices" management command for the real end-of-day
# batch version of the same thing.
VOID_AGE = timedelta(hours=24)

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
    STATUS_QUOTE = "quote"  # saved but not a real bill yet — no payment can be recorded against it
    STATUS_VOID = "void"  # permanently locked, kept only for the record — see Invoice.is_locked()
    STATUS_CHOICES = [
        (STATUS_UNPAID, "Unpaid"),
        (STATUS_PAID, "Paid"),
        (STATUS_REFUNDED, "Refunded"),
        (STATUS_QUOTE, "Quote"),
        (STATUS_VOID, "Void"),
    ]

    # PROTECT means: Django will refuse to delete a Client or Service if
    # there's still an invoice pointing at it. That's intentional — you
    # don't want deleting a client to silently wipe out their invoice
    # history. (This is also why the Settings doc talks about "archiving"
    # a client instead of deleting them.)
    client = models.ForeignKey("clients.Client", on_delete=models.PROTECT, related_name="invoices")
    discount = models.ForeignKey(Discount, on_delete=models.SET_NULL, null=True, blank=True)
    # Optional, and only ever set when an invoice was created FROM a
    # specific appointment (the "Create invoice" button on the client
    # profile's Appointments tab) — that's what lets that tab show
    # "Invoiced #INV-1001" instead of just "Active" for that appointment.
    # Most invoices won't have one, since not every sale starts from a
    # calendar booking.
    appointment = models.ForeignKey(
        "scheduling.Appointment", on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )

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

    def is_locked(self):
        # Every invoice freezes (no line item, payment, or discount
        # change allowed) once it's 24 hours old, automatically — an
        # audit-integrity rule, not a payment-status rule. This is
        # completely independent of `status`: a PAID invoice locks just
        # as much as an unpaid one, it just keeps saying "Paid" forever
        # (see sync_void_status() below for the part that used to get
        # this wrong). Enforced here AND in the serializers/views that
        # touch an invoice's children, since a line item or payment
        # doesn't know its own invoice's status without asking.
        #
        # Age-aware rather than a stored "locked" flag on purpose: this
        # check works instantly the moment an invoice turns 24 hours
        # old, even if sync_void_status() hasn't happened to run against
        # this exact row yet — no gap where a write could slip through
        # between "old enough" and "some background job catching up."
        #
        # A Quote is exempt — it isn't a real bill yet, so there's
        # nothing about it that needs the same audit-integrity lock a
        # real invoice does.
        if self.status == self.STATUS_VOID:
            return True
        if self.status == self.STATUS_QUOTE:
            return False
        return timezone.now() - self.created_at >= VOID_AGE

    def sync_void_status(self):
        """
        Flips this invoice over to Void and saves, but ONLY if it's
        aged past the cutoff and was NEVER paid — an invoice that's
        actually Paid or Refunded keeps that real status forever;
        is_locked() above already freezes it from further edits on its
        own, independent of `status`, so there's nothing left for Void
        to mean for a paid invoice except "confusingly overwrite real
        payment history," which is exactly what this used to do before
        Mako flagged it (a paid invoice was showing as "Void" in
        Reports once it aged, even though the payment was completely
        real). "Void" now means one thing only: aged out, never paid —
        essentially a dead invoice nobody's ever going to collect on.
        A Quote is still exempt (isn't a real bill yet).

        Called whenever an invoice is fetched (see
        InvoiceViewSet.get_queryset()) so the STATUS FIELD ITSELF stays
        accurate without anything needing to run on an actual schedule.
        The "void_expired_invoices" management command does the same
        thing in bulk, for wiring up to a real daily cron/scheduler later.
        """
        if self.status != self.STATUS_UNPAID:
            return False
        if timezone.now() - self.created_at < VOID_AGE:
            return False
        self.status = self.STATUS_VOID
        self.save(update_fields=["status"])
        return True

    def subtotal(self):
        # Sum of every NON-VOIDED line item's own net amount (after that
        # line's own discount, and negated already if it's a refund line
        # — see InvoiceLineItem.net_amount()). Voided lines (edited or
        # removed after the fact) are kept in the database and still
        # shown, crossed out, on the invoice — they just don't count
        # toward the total anymore. Rounded to the cent, same as every
        # other total here — see the note on total_due() for why that
        # rounding matters.
        total = sum(
            (item.net_amount() for item in self.line_items.filter(is_voided=False)),
            Decimal("0"),  # start the sum at Decimal(0) instead of int 0, so the math stays Decimal-typed throughout
        )
        return total.quantize(CENTS)

    def discount_amount(self):
        # Per Mako: the invoice-level discount applies to the TOTAL (the
        # subtotal plus tax), not just the pre-tax subtotal — simpler to
        # reason about than trying to prorate it across taxable and
        # non-taxable lines, and matches how he described it.
        if not self.discount_id:
            return Decimal("0")
        pre_discount_total = self.subtotal() + self.tax_amount
        if self.discount.type == Discount.TYPE_FLAT:
            amount = min(self.discount.amount, pre_discount_total)
        else:
            amount = pre_discount_total * self.discount.amount / Decimal("100")
        return amount.quantize(CENTS)

    def total_due(self):
        # This is a plain Python method (not a database field) — it gets
        # recalculated on the fly whenever something calls invoice.total_due(),
        # so it's always accurate even if line items changed after the
        # invoice was created.
        #
        # Rounded to the cent (not left as a raw fractional-cent Decimal)
        # — this used to be a real bug: a $162.7538... "true" total would
        # DISPLAY as $162.75 (rounded), someone would pay exactly that,
        # and the invoice would stay stuck on "unpaid" forever because
        # $162.75 is technically still a hair less than $162.7538. Once
        # this is rounded the same way it's displayed, "pay the amount
        # shown" always actually satisfies the balance.
        pre_discount_total = self.subtotal() + self.tax_amount
        return (pre_discount_total - self.discount_amount()).quantize(CENTS)


class InvoiceLineItem(models.Model):
    """
    One row on an invoice — e.g. "2x Lawn Maintenance at $75 each."
    An invoice usually has several of these.
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="line_items")
    service = models.ForeignKey("services.Service", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)  # captured at the time of the invoice — if the Service's price changes later, old invoices stay correct
    # Same snapshot idea as unit_price, but for what this line actually
    # cost the business (Service.cost at the moment it was added) —
    # used for Cost of Goods Sold in reports/views.py. Null when the
    # Service had no cost set at the time (see Service.cost's own
    # comment) — a refund line also leaves this null, since there's no
    # cost basis for money being handed back (see add_line_item()).
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_refund_line = models.BooleanField(default=False)  # True marks this row as a refund added after the fact, not part of the original sale — see InvoiceViewSet.add_line_item()

    # A one-off discount on just THIS line — separate from (and in
    # addition to) the invoice-wide Discount on Invoice.discount above.
    # Deliberately NOT a reference to a saved Discount: per Mako, a
    # line-item discount is a quick "knock $10 off this one service" or
    # "10% off just the mulch delivery" typed in on the spot, not
    # something picked from the reusable list. discount_value is null
    # when there's no discount on this line at all.
    DISCOUNT_TYPE_FLAT = "flat"
    DISCOUNT_TYPE_PERCENT = "percent"
    DISCOUNT_TYPE_CHOICES = [(DISCOUNT_TYPE_FLAT, "Flat"), (DISCOUNT_TYPE_PERCENT, "Percent")]

    discount_type = models.CharField(max_length=10, choices=DISCOUNT_TYPE_CHOICES, default=DISCOUNT_TYPE_FLAT)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # Per Mako: editing or removing a line item after the fact should
    # never actually delete anything — the old row stays exactly as it
    # was, just marked voided (shown crossed out on the invoice) with a
    # note explaining why, so there's a full record of every change made.
    # A "revised" line item is really two rows: the old one voided with a
    # note, and a fresh unvoided one with the corrected values — see
    # InvoiceViewSet.add_line_item()/void_line_item().
    is_voided = models.BooleanField(default=False)
    void_note = models.TextField(blank=True)

    def gross_amount(self):
        return self.quantity * self.unit_price

    def cost_amount(self):
        # What this line actually cost the business — NOT reduced by
        # this line's discount, since discounting what you charge a
        # client doesn't change what you paid for the product/materials.
        if self.unit_cost is None:
            return Decimal("0")
        return self.quantity * self.unit_cost

    def discount_amount(self):
        if not self.discount_value:
            return Decimal("0")
        gross = self.gross_amount()
        if self.discount_type == self.DISCOUNT_TYPE_FLAT:
            return min(self.discount_value, gross)
        return gross * self.discount_value / Decimal("100")

    def net_amount(self):
        # A refund line CREDITS the client — it subtracts from what's
        # owed rather than adding to it, so the invoice's total actually
        # reflects the refund instead of just cosmetically labeling a row
        # "(refund)" while still charging for it.
        amount = self.gross_amount() - self.discount_amount()
        return -amount if self.is_refund_line else amount


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
