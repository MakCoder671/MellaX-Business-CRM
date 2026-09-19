from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers

from .models import BusinessAccount


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    accept_tos = serializers.BooleanField(write_only=True)
    # Model default is "basic", but the plan is a deliberate choice made at
    # signup (business_plan.MD, Sign-Up & Onboarding Flow step 4) — never
    # silently defaulted, so this is required rather than inheriting the
    # model's implicit optionality.
    plan_tier = serializers.ChoiceField(choices=[BusinessAccount.PLAN_BASIC, BusinessAccount.PLAN_PLUS])

    class Meta:
        model = BusinessAccount
        fields = ["email", "business_name", "password", "accept_tos", "plan_tier"]

    def validate_accept_tos(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must accept the Terms of Service and Privacy Policy."
            )
        return value

    def create(self, validated_data):
        validated_data.pop("accept_tos")
        password = validated_data.pop("password")
        account = BusinessAccount.objects.create_user(
            password=password, accepted_tos_at=timezone.now(), **validated_data
        )
        return account


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        account = authenticate(
            username=attrs["email"].lower(), password=attrs["password"]
        )
        if account is None:
            raise serializers.ValidationError("Invalid email or password.")
        if not account.is_email_verified:
            raise serializers.ValidationError(
                "Please verify your email before logging in."
            )
        attrs["account"] = account
        return attrs


class BusinessAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessAccount
        fields = [
            "id",
            "email",
            "business_name",
            "plan_tier",
            "phone",
            "address",
            "is_email_verified",
            "created_at",
        ]
        read_only_fields = ["id", "email", "plan_tier", "is_email_verified", "created_at"]
