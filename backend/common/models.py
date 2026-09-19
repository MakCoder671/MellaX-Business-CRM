from django.db import models


class TenantScopedQuerySet(models.QuerySet):
    def for_account(self, business_account):
        return self.filter(business_account=business_account)


class TenantScopedManager(models.Manager):
    """Base manager for every tenant-owned table.

    Doesn't auto-filter by request context on its own (a manager has no
    request), but every view MUST call `.for_account(request.user)` rather
    than the bare queryset, so there is one obvious, greppable call site
    per query instead of a manual `.filter(business_account=...)` that's
    easy to forget on a new endpoint.
    """

    def get_queryset(self):
        return TenantScopedQuerySet(self.model, using=self._db)

    def for_account(self, business_account):
        return self.get_queryset().for_account(business_account)


class TenantScopedModel(models.Model):
    business_account = models.ForeignKey(
        "accounts.BusinessAccount",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        abstract = True
