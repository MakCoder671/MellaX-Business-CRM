from django.db import models

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# A "Service" is whatever a business charges money for — could be an
# actual service ("Lawn Maintenance") or a physical product/job
# ("10x10 Deck Build"). We don't have a separate Product model; Service
# covers both, which keeps things simple for v1 — is_product just tags
# which of the two tabs (Services vs Products) a row shows up under,
# and the inventory fields below only ever apply to a product (see
# services/views.py's ProductViewSet vs ServiceViewSet, which is what
# actually keeps the two tabs from showing each other's rows).
# ----------------------------------------------------------------------------


class Service(TenantScopedModel):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)  # DecimalField, not FloatField — money needs exact math, not floating-point rounding errors
    # What it actually costs the business to deliver this service or
    # source this product (materials, wholesale cost, contractor pay —
    # whatever it is) — separate from `price`, which is what the CLIENT
    # pays. Optional on purpose: a business that doesn't want to bother
    # tracking cost still gets a working invoice and P&L report, just
    # without a Gross Profit line for that item (see InvoiceLineItem's
    # matching unit_cost snapshot, and reports/views.py).
    cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    description = models.TextField(blank=True)
    is_taxable = models.BooleanField(default=True)  # controls whether this line item gets taxed on an invoice

    is_product = models.BooleanField(default=False)  # False = shows under Services, True = shows under Products

    # Inventory tracking — only meaningful when is_product=True, and
    # even then it's optional: a product with either of these left
    # blank just never gets a low-stock warning, for a business that
    # doesn't want to bother tracking it.
    stock_quantity = models.PositiveIntegerField(null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)  # a warning triggers once stock_quantity drops to (or below) this

    # A low-stock warning that's been handled — either snoozed for a
    # while (low_stock_snoozed_until) or dismissed outright
    # (low_stock_dismissed) — shouldn't keep popping back up. Both reset
    # automatically the moment stock gets high enough again (see save()
    # below), so a NEW dip below the threshold later always warns again
    # instead of staying silenced forever from one old dismissal.
    low_stock_dismissed = models.BooleanField(default=False)
    low_stock_snoozed_until = models.DateTimeField(null=True, blank=True)

    def is_low_stock(self):
        if not self.is_product or self.stock_quantity is None or self.low_stock_threshold is None:
            return False
        return self.stock_quantity <= self.low_stock_threshold

    def save(self, *args, **kwargs):
        # Restocked back above the warning line? Clear any earlier
        # snooze/dismissal so the NEXT time it dips low, it warns again
        # instead of staying silenced from a dismissal that was really
        # about a previous, already-resolved shortage.
        if (
            self.stock_quantity is not None
            and self.low_stock_threshold is not None
            and self.stock_quantity > self.low_stock_threshold
        ):
            self.low_stock_dismissed = False
            self.low_stock_snoozed_until = None
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
