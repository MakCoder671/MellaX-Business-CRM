from django.db import models

from common.models import TenantScopedModel


class Service(TenantScopedModel):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    is_taxable = models.BooleanField(default=True)

    def __str__(self):
        return self.name
