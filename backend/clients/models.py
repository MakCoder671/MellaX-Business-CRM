from django.db import models

from common.models import TenantScopedModel


class Client(TenantScopedModel):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.name
