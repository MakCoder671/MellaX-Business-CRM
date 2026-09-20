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
    # Split into first/last instead of one "name" field — per Mako, this
    # is specifically so a future CSV import/export has clean, unambiguous
    # columns to map to (see business_plan.MD's Data Import section,
    # which already assumed "ClientFirstName, ClientLastName" as the
    # template columns — the model just hadn't caught up to that yet).
    #
    # blank=True at the DB level on purpose, even though every NEW client
    # is required to have both (see clients/serializers.py) — that's a
    # deliberate split: the database stays permissive so a migration
    # backfilling old data (or some future import with a messy row)
    # can't fail outright, while the API is what actually enforces the
    # real-world rule for anything created going forward.
    first_name = models.CharField(max_length=255, blank=True)
    last_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)  # blank=True means "optional in forms", not "allowed to be NULL in the DB"
    phone = models.CharField(max_length=32, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        # Controls how a Client shows up in the Django admin and in debug output.
        return self.full_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()
