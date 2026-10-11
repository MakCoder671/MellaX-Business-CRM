from django.db import models

from common.models import TenantScopedModel

from .schedule_c import CATEGORY_KEYS


class RecurringExpense(TenantScopedModel):
    """
    A cost that repeats every month, like rent, software, or equipment upkeep.
    MellaX adds one expense for each month, on the same day of the month as the
    start date, and keeps adding them until the owner stops it. Past months stay.
    """

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=40, choices=[(key, key) for key in CATEGORY_KEYS])
    description = models.CharField(max_length=200)
    vendor = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    start_date = models.DateField()  # the first month that gets logged
    last_logged_month = models.DateField(null=True, blank=True)  # the first day of the most recent month already logged
    ended = models.BooleanField(default=False)  # True once the owner stops repeating it
    ended_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Every month: {self.description} {self.amount}"


class Expense(TenantScopedModel):
    """
    A cost of running the business: rent, supplies, ads, software, and so on.
    Reports subtract these from income to show real profit, and the tax center
    groups them by Schedule C category.
    """

    date = models.DateField()  # the day the cost was paid or incurred
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=40, choices=[(key, key) for key in CATEGORY_KEYS])
    description = models.CharField(max_length=200)
    vendor = models.CharField(max_length=120, blank=True)  # who was paid, like "Costco" or "Google"
    note = models.TextField(blank=True)  # anything else worth remembering, like "receipt in the blue folder"
    # Set when this expense was added automatically by a repeating expense. Stopping the repeat removes its future months.
    recurring = models.ForeignKey(RecurringExpense, null=True, blank=True, on_delete=models.SET_NULL, related_name="entries")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.date} {self.description} {self.amount}"


class OtherIncome(TenantScopedModel):
    """
    Business income that isn't an invoice: tips, reimbursements, or a refund you received.
    It goes on Schedule C line 6, so it's added to income in the tax packet.
    """

    date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=200)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
