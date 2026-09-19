from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import BusinessAccount

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
    list_display = ("email", "business_name", "plan_tier", "is_email_verified", "is_staff")
    ordering = ("email",)

    # How fields are grouped when you open one account to edit it.
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Business info", {"fields": ("business_name", "phone", "address", "plan_tier")}),
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
