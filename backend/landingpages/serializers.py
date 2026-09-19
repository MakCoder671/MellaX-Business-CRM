from rest_framework import serializers

from services.models import Service

from .models import LandingPage, LandingPagePhoto


class LandingPagePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingPagePhoto
        fields = ["id", "image", "display_order"]


class PublicServiceSerializer(serializers.ModelSerializer):
    """Only the fields safe to show to the public (business_plan.MD,
    Account Creation & Security, principle 5) — no cost/margin internals."""

    class Meta:
        model = Service
        fields = ["name", "description", "price"]


class PublicLandingPageSerializer(serializers.ModelSerializer):
    """Read-only, public-facing view of an account's landing page. Exposes
    only business name/blurb/services/photos/contact info — never the full
    BusinessAccount record — per the doc's public-surface principle."""

    business_name = serializers.CharField(source="business_account.business_name")
    phone = serializers.CharField(source="business_account.phone")
    email = serializers.EmailField(source="business_account.email")
    photos = LandingPagePhotoSerializer(many=True, read_only=True)
    services = serializers.SerializerMethodField()

    class Meta:
        model = LandingPage
        fields = [
            "slug",
            "business_name",
            "blurb_text",
            "phone",
            "email",
            "photos",
            "services",
            "booking_enabled",
        ]

    def get_services(self, landing_page):
        services = Service.objects.for_account(landing_page.business_account)
        return PublicServiceSerializer(services, many=True).data


class LandingPageSerializer(serializers.ModelSerializer):
    """Authenticated owner-facing serializer for editing their own page."""

    class Meta:
        model = LandingPage
        fields = ["id", "slug", "blurb_text", "booking_enabled", "created_at", "updated_at"]
        read_only_fields = ["id", "booking_enabled", "created_at", "updated_at"]
