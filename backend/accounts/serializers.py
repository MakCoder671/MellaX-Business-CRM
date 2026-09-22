from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers

from .models import BusinessAccount

# ----------------------------------------------------------------------------
# "Serializers" in Django REST Framework do two jobs:
#   1. Turn incoming JSON (from the frontend) into validated Python data
#      and eventually a database row — this is what happens on POST/PUT.
#   2. Turn a database row into JSON to send back to the frontend — this
#      is what happens on GET.
#
# Think of them as the translator sitting between "raw JSON over HTTP" and
# "actual Django model objects."
# ----------------------------------------------------------------------------


class SignupSerializer(serializers.ModelSerializer):
    """Handles the POST /api/accounts/signup/ request body."""

    # write_only means: accept this field when creating an account, but
    # never include it when sending account data back out (obviously you
    # don't want to echo the password back!).
    password = serializers.CharField(write_only=True, min_length=8)
    accept_tos = serializers.BooleanField(write_only=True)

    # The model's plan_tier field defaults to "basic", which would make
    # DRF treat it as optional. But per the plan doc, picking a plan is a
    # deliberate step at signup — never silently defaulted — so we
    # redeclare it here as its own required field, and only allow the two
    # plans someone can actually sign up for (Premium isn't purchasable yet).
    plan_tier = serializers.ChoiceField(choices=[BusinessAccount.PLAN_BASIC, BusinessAccount.PLAN_PLUS])

    class Meta:
        model = BusinessAccount
        fields = ["email", "business_name", "password", "accept_tos", "plan_tier"]

    def validate_accept_tos(self, value):
        # DRF automatically calls any method named `validate_<fieldname>`
        # for that specific field. This one just makes sure the checkbox
        # was actually checked — can't create an account without it.
        if not value:
            raise serializers.ValidationError(
                "You must accept the Terms of Service and Privacy Policy."
            )
        return value

    def create(self, validated_data):
        # Called automatically when you do `serializer.save()` on a valid
        # signup. `validated_data` is a plain dict of everything that
        # passed validation above.
        validated_data.pop("accept_tos")  # not a real model field, just used it for the check above
        password = validated_data.pop("password")
        account = BusinessAccount.objects.create_user(
            password=password, accepted_tos_at=timezone.now(), **validated_data
        )

        # Per the plan doc: "Every account gets a landing page from day
        # one." Imported here (not at the top of the file) to avoid the
        # accounts app needing to know about landingpages at import time —
        # this way it's only ever loaded right when it's actually needed.
        from landingpages.models import LandingPage

        LandingPage.objects.create(business_account=account, slug=f"business-{account.pk}")

        return account


class LoginSerializer(serializers.Serializer):
    """
    Handles POST /api/accounts/login/. Not a ModelSerializer because we're
    not creating/updating a row here — just validating credentials.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        # `validate()` (no field name) runs after all the individual
        # fields pass their own checks — good place for "does this
        # combination of email+password actually work" logic.
        account = authenticate(
            username=attrs["email"].lower(), password=attrs["password"]
        )
        # Django's authenticate() calls the `username` kwarg "username" no
        # matter what your actual USERNAME_FIELD is — it just looks up
        # whatever value you pass against that field. Since BusinessAccount
        # uses USERNAME_FIELD = "email", this correctly checks email+password.
        if account is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not account.is_email_verified:
            raise serializers.ValidationError(
                "Please verify your email before logging in."
            )
        # Stash the found account on attrs so the view can grab it without
        # doing another database lookup.
        attrs["account"] = account
        return attrs


class BusinessAccountSerializer(serializers.ModelSerializer):
    """
    Used for GET/PATCH /api/accounts/me/ — the whole Settings tab reads
    and writes through this one serializer, since almost every Settings
    field lives directly on BusinessAccount (see the comment in
    accounts/models.py explaining why).
    """

    class Meta:
        model = BusinessAccount
        fields = [
            "id",
            "email",
            "business_name",
            "plan_tier",
            # Business Information
            "phone",
            "address",
            # Branding
            "logo",
            # Theme
            "theme_accent",
            "theme_background",
            # Calendar Settings
            "allow_double_booking",
            "default_calendar_view",
            "calendar_accent",
            # Invoice Settings
            "service_tax_percent",
            "product_tax_percent",
            "invoice_prefix",
            "default_invoice_terms",
            "time_zone",
            "is_email_verified",
            "created_at",
        ]
        # read_only_fields = things that show up in the JSON response but
        # can't be changed by sending them in a PATCH request. Makes sense:
        # you shouldn't be able to un-verify your own email or change your
        # own plan tier by editing your profile form (plan changes are a
        # Fast-Follow feature — self-service billing isn't wired up yet).
        read_only_fields = ["id", "email", "plan_tier", "is_email_verified", "created_at"]
