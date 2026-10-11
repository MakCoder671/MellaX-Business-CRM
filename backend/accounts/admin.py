from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import BusinessAccount, SupportRequest

# ----------------------------------------------------------------------------
# This file controls how BusinessAccount looks inside Django's built-in
# /admin/ site — a free, auto-generated admin panel you get just by
# registering a model here. Handy for you (the site owner) to peek at
# data or fix something by hand without writing SQL.
#
# We're extending Django's UserAdmin (instead of the plain ModelAdmin)
# because BusinessAccount IS our user model — UserAdmin already knows how
# to handle password hashing/changing safely in the admin forms.
# ----------------------------------------------------------------------------


@admin.register(BusinessAccount)
class BusinessAccountAdmin(UserAdmin):
    model = BusinessAccount

    # Columns shown in the admin's list-of-accounts table.
    list_display = ("email", "business_name", "plan_tier", "subscription_status", "is_active", "is_email_verified")
    list_filter = ("plan_tier", "subscription_status", "is_active")
    ordering = ("email",)

    # How fields are grouped when you open one account to edit it. This is
    # also where you manually manage a demo account by hand for now: flip
    # plan_tier for a free upgrade/downgrade, push out trial_ends_at to
    # extend someone's trial, or set subscription_status/is_active to turn
    # a canceled or demo account back on. See Settings > Account &
    # Subscription on the frontend for the self-service version of this.
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Business info", {"fields": ("business_name", "phone", "address", "plan_tier")}),
        ("Subscription", {"fields": ("subscription_status", "trial_ends_at", "canceled_at")}),
        ("Status", {"fields": ("is_email_verified", "accepted_tos_at", "is_active", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
    )

    # Fields shown on the "add a new account" form specifically (simpler
    # than the full edit form above — just enough to create one).
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "business_name", "password1", "password2"),
        }),
    )

    search_fields = ("email", "business_name")  # powers the search box at the top of the list page


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    # A backup view of Settings > Feedback & Support submissions, for whenever
    # OWNER_NOTIFY_EMAIL isn't set (e.g. still in local dev) or an email just
    # gets missed — nothing submitted here depends on email actually working.
    list_display = ("created_at", "business_account", "category", "short_message")
    list_filter = ("category",)
    search_fields = ("business_account__email", "business_account__business_name", "message")
    readonly_fields = ("business_account", "category", "message", "created_at")

    def short_message(self, obj):
        return obj.message if len(obj.message) <= 80 else obj.message[:77] + "..."
