from django.db import models

from common.models import TenantScopedModel

# ----------------------------------------------------------------------------
# The simplest model in the app — a good one to look at first if you're
# learning how TenantScopedModel (see common/models.py) works in practice.
#
# By inheriting from TenantScopedModel, this model automatically gets:
#   - business_account (which business owns this client)
#   - created_at / updated_at
#   - a tenant-scoped .objects manager
# ...without us having to write any of that here. All we add is the
# fields that are actually specific to a Client.
# ----------------------------------------------------------------------------


class Client(TenantScopedModel):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)  # blank=True means "optional in forms", not "allowed to be NULL in the DB"
    phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        # Controls how a Client shows up in the Django admin and in debug output.
        return self.name
