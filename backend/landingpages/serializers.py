from rest_framework import serializers

from services.models import Service

from .models import LandingPage, LandingPagePhoto

# ----------------------------------------------------------------------------
# Two very different serializers in here, and the difference matters a
# lot for security:
#
#   PublicLandingPageSerializer -- for the anonymous, public-facing view.
#     Only ever includes fields that are SAFE to show a total stranger.
#
#   LandingPageSerializer -- for the business owner editing their own
#     page while logged in.
#
# We keep these as two separate classes on purpose, instead of one
# serializer with some "if request.user is authenticated" branching
# inside it — that kind of conditional logic is exactly the sort of thing
# that's easy to get wrong and accidentally leak private data. Two
# obviously-separate serializers are much harder to mess up.
# ----------------------------------------------------------------------------


class LandingPagePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingPagePhoto
        fields = ["id", "image", "display_order"]


class PublicServiceSerializer(serializers.ModelSerializer):
    """
    Only the Service fields safe to show the public — notice this
    deliberately leaves out things like is_taxable or internal notes.
    """

    class Meta:
        model = Service
        fields = ["name", "description", "price"]


class PublicLandingPageSerializer(serializers.ModelSerializer):
    """
    What a random visitor on the internet sees at mellax.com/l/<slug>.
    Built from LandingPage, but pulls in a few fields from the related
    BusinessAccount (business name, phone, email) — WITHOUT exposing the
    whole BusinessAccount record (which would include things like
    plan_tier, invoice settings, etc that are nobody else's business).
    """

    # `source="business_account.business_name"` means "reach through the
    # business_account relationship and grab THIS field" — lets us expose
    # just the one field we want from a related model, cleanly.
    business_name = serializers.CharField(source="business_account.business_name")
    phone = serializers.CharField(source="business_account.phone")
    email = serializers.EmailField(source="business_account.email")

    photos = LandingPagePhotoSerializer(many=True, read_only=True)
    services = serializers.SerializerMethodField()  # a "computed" field — see get_services() below

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
        # SerializerMethodField calls a method named `get_<fieldname>` to
        # produce that field's value — here we look up all of this
        # business's services and run them through the "safe for public"
        # serializer above.
        services = Service.objects.for_account(landing_page.business_account)
        return PublicServiceSerializer(services, many=True).data


class LandingPageSerializer(serializers.ModelSerializer):
    """The private, logged-in version — for the owner editing their own page."""

    class Meta:
        model = LandingPage
        fields = ["id", "slug", "blurb_text", "booking_enabled", "created_at", "updated_at"]
        read_only_fields = ["id", "booking_enabled", "created_at", "updated_at"]  # booking_enabled is a Plus-tier toggle, not something to flip via this form yet
