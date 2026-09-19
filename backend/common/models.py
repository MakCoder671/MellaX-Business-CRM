from django.db import models

# ----------------------------------------------------------------------------
# This file is the foundation for keeping every business's data separate.
#
# MellaX is "multi-tenant" — lots of different businesses (tenants) share
# the same database, same tables, same everything. The only thing keeping
# Business A from seeing Business B's clients/invoices/etc is a
# `business_account` column on every table. If even ONE view forgets to
# filter by that column, you've got a data leak between customers — bad.
#
# So instead of trusting every developer (including future-you) to
# remember `.filter(business_account=request.user)` every single time,
# we bake it into a custom manager. Every model that stores business data
# inherits from TenantScopedModel below, which gives it a `.for_account()`
# method that's hard to forget because it's the ONLY convenient way to
# query the table.
# ----------------------------------------------------------------------------


class TenantScopedQuerySet(models.QuerySet):
    # Just a normal Django QuerySet, but with one extra helper method.
    def for_account(self, business_account):
        return self.filter(business_account=business_account)


class TenantScopedManager(models.Manager):
    """
    This is what you see as `Model.objects` on every tenant-owned model.

    A "manager" in Django is the thing that handles `Model.objects.all()`,
    `Model.objects.filter(...)`, etc. We're overriding it so that
    `Model.objects.for_account(some_business)` is always available.

    Note: this doesn't happen automatically just because a request came
    in — a manager has no idea what the current logged-in user is. Every
    view still has to explicitly call `.for_account(request.user)`. What
    this DOES do is make that the obvious, easy, greppable pattern to use,
    instead of everyone writing their own `.filter(business_account=...)`
    slightly differently.
    """

    def get_queryset(self):
        # Swap in our custom queryset (the one with .for_account on it)
        # instead of Django's plain default.
        return TenantScopedQuerySet(self.model, using=self._db)

    def for_account(self, business_account):
        return self.get_queryset().for_account(business_account)


class TenantScopedModel(models.Model):
    """
    An "abstract base model" — meaning nothing gets created in the database
    for THIS class directly. Instead, other models (Client, Service,
    Invoice, etc.) inherit from it and automatically get:

      - a `business_account` foreign key (which business owns this row)
      - `created_at` / `updated_at` timestamps, auto-managed
      - the tenant-scoped `.objects` manager described above

    So instead of retyping these fields on every single model, we write
    them once here and reuse them everywhere.
    """

    business_account = models.ForeignKey(
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,  # if the business account is deleted, delete this row too
        related_name="%(class)ss",  # e.g. business_account.clients.all(), business_account.services.all()
    )
    created_at = models.DateTimeField(auto_now_add=True)  # set once, when the row is first created
    updated_at = models.DateTimeField(auto_now=True)  # updated every time the row is saved

    objects = TenantScopedManager()

    class Meta:
        abstract = True  # tells Django "don't make a table for this one, it's just a template"
