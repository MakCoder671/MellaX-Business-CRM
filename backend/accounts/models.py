from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class BusinessAccountManager(BaseUserManager):
    def create_user(self, email, business_name, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        if not business_name:
            raise ValueError("Business name is required")
        email = self.normalize_email(email)
        account = self.model(email=email, business_name=business_name, **extra_fields)
        account.set_password(password)
        account.save(using=self._db)
        return account

    def create_superuser(self, email, business_name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_email_verified", True)
        return self.create_user(email, business_name, password, **extra_fields)


class BusinessAccount(AbstractBaseUser, PermissionsMixin):
    PLAN_BASIC = "basic"
    PLAN_PLUS = "plus"
    PLAN_PREMIUM = "premium"
    PLAN_CHOICES = [
        (PLAN_BASIC, "Basic"),
        (PLAN_PLUS, "Plus"),
        (PLAN_PREMIUM, "Premium"),
    ]

    email = models.EmailField(unique=True)
    business_name = models.CharField(max_length=255)
    plan_tier = models.CharField(max_length=10, choices=PLAN_CHOICES, default=PLAN_BASIC)

    # Business Information (Settings section)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)

    # ToS acceptance (Sign-Up & Onboarding Flow, step 2)
    accepted_tos_at = models.DateTimeField(null=True, blank=True)
    is_email_verified = models.BooleanField(default=False)

    # Invoice Settings (Settings section)
    service_tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    product_tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    invoice_prefix = models.CharField(max_length=16, default="INV-")
    next_invoice_sequence = models.PositiveIntegerField(default=1001)
    default_invoice_terms = models.TextField(blank=True, default="Payment due upon receipt.")
    time_zone = models.CharField(max_length=64, default="UTC")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BusinessAccountManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["business_name"]

    def __str__(self):
        return self.business_name
