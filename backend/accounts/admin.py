from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import BusinessAccount


@admin.register(BusinessAccount)
class BusinessAccountAdmin(UserAdmin):
    model = BusinessAccount
    list_display = ("email", "business_name", "plan_tier", "is_email_verified", "is_staff")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Business info", {"fields": ("business_name", "phone", "address", "plan_tier")}),
        ("Status", {"fields": ("is_email_verified", "accepted_tos_at", "is_active", "is_staff", "is_superuser")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "business_name", "password1", "password2"),
        }),
    )
    search_fields = ("email", "business_name")
