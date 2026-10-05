from django.utils.text import slugify
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


MAX_PHOTO_BYTES = 5 * 1024 * 1024


class LandingPagePhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingPagePhoto
        fields = ["id", "image", "display_order"]
        read_only_fields = ["id", "display_order"]  # order is set by the server (end of list on upload, reorder endpoint after that)

    def validate_image(self, image):
        if image.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("That photo is over 5 MB. Try a smaller version.")
        return image


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
    BusinessAccount (business name, phone, email, address, logo) —
    WITHOUT exposing the whole BusinessAccount record (which would
    include things like plan_tier, invoice settings, etc that are
    nobody else's business).

    This is also the "Business Information flows to the landing page
    automatically" connection: since these fields are sourced straight
    from BusinessAccount, editing them in Settings > Business
    Information (or the logo in Branding) updates the public page too,
    with nothing to re-enter twice.
    """

    # `source="business_account.business_name"` means "reach through the
    # business_account relationship and grab THIS field" — lets us expose
    # just the one field we want from a related model, cleanly.
    business_name = serializers.CharField(source="business_account.business_name")
    phone = serializers.CharField(source="business_account.phone")
    email = serializers.EmailField(source="business_account.email")
    address = serializers.CharField(source="business_account.address")
    city = serializers.CharField(source="business_account.city")
    state = serializers.CharField(source="business_account.state")
    zip_code = serializers.CharField(source="business_account.zip_code")
    logo = serializers.ImageField(source="business_account.logo", read_only=True)

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
            "address",
            "city",
            "state",
            "zip_code",
            "logo",
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


RESERVED_SLUGS = {"api", "admin", "dashboard", "l", "login", "signup", "static", "media"}  # would clash with real app routes like /l/<slug>


class LandingPageSerializer(serializers.ModelSerializer):
    """The private, logged-in version — for the owner editing their own page."""

    # A plain CharField, not the model's SlugField: SlugField rejects anything
    # that isn't already a slug (spaces, apostrophes, capitals) before
    # validate_slug below ever gets to tidy it up.
    slug = serializers.CharField(max_length=50)
    photos = LandingPagePhotoSerializer(many=True, read_only=True)

    class Meta:
        model = LandingPage
        fields = ["id", "slug", "blurb_text", "booking_enabled", "photos", "created_at", "updated_at"]
        read_only_fields = ["id", "booking_enabled", "created_at", "updated_at"]  # booking_enabled is a Plus-tier toggle, not something to flip via this form yet

    def validate_slug(self, value):
        # Lowercase and hyphenate whatever the owner typed, so "Jane's Lawn
        # Care" becomes "janes-lawn-care" instead of being rejected outright.
        slug = slugify(value)
        if len(slug) < 3:
            raise serializers.ValidationError("Use at least 3 letters or numbers for your page address.")
        if slug in RESERVED_SLUGS:
            raise serializers.ValidationError("That address is reserved. Try something more specific.")
        taken = LandingPage.objects.filter(slug=slug).exclude(pk=getattr(self.instance, "pk", None)).exists()
        if taken:
            raise serializers.ValidationError("That address is already taken.")
        return slug
