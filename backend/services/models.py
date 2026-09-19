from django.db import models

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# A "Service" is whatever a business charges money for — could be an
# actual service ("Lawn Maintenance") or a physical product/job
# ("10x10 Deck Build"). We don't have a separate Product model; Service
# covers both, which keeps things simple for v1.
# ----------------------------------------------------------------------------


class Service(TenantScopedModel):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)  # DecimalField, not FloatField — money needs exact math, not floating-point rounding errors
    description = models.TextField(blank=True)
    is_taxable = models.BooleanField(default=True)  # controls whether this line item gets taxed on an invoice

    def __str__(self):
        return self.name
