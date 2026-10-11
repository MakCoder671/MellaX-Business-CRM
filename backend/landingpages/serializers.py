from urllib.parse import urlparse

from rest_framework import serializers

from scheduling.models import BusinessHours
from services.models import Service

from .models import SOCIAL_PLATFORM_CHOICES, LandingPage, LandingPagePhoto, LandingPageReview

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

# Social links: one per network, and a sane length cap on each URL.
SOCIAL_PLATFORM_LABELS = dict(SOCIAL_PLATFORM_CHOICES)
MAX_SOCIAL_URL_LENGTH = 300


def _clean_social_url(raw):
    # People type "instagram.com/mybiz" without the https part, so add it for them.
    url = raw if "://" in raw else f"https://{raw}"
    parts = urlparse(url)
    # Only real web addresses. This blocks things like javascript: links.
    if parts.scheme not in ("http", "https") or "." not in parts.netloc or " " in url:
        raise serializers.ValidationError("That doesn't look like a web address. Try something like instagram.com/yourbusiness.")
    return url


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
    Only the Service fields safe to show the public. The id and duration are
    here so the booking form can pick a service and offer slots that fit it.
    """

    class Meta:
        model = Service
        fields = ["id", "name", "description", "price", "duration_minutes"]


class PublicHoursSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessHours
        fields = ["day_of_week", "is_open", "open_time", "close_time"]


class PublicLandingPageSerializer(serializers.ModelSerializer):
    """
    What a random visitor on the internet sees at mellax.com/l/<slug>.
    Built from LandingPage, but pulls in a few fields from the related
    BusinessAccount (business name, phone, email, address, logo, theme) —
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
    time_zone = serializers.CharField(source="business_account.time_zone")
    landing_accent = serializers.CharField()
    landing_font = serializers.CharField()
    landing_corners = serializers.CharField()

    photos = LandingPagePhotoSerializer(many=True, read_only=True)
    services = serializers.SerializerMethodField()  # a "computed" field — see get_services() below
    hours = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    booking_available = serializers.BooleanField(read_only=True)

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
            "time_zone",
            "landing_accent",
            "landing_background",
            "landing_font",
            "landing_corners",
            "landing_cards",
            "social_links",
            "hero_mark",
            "photos",
            "services",
            "hours",
            "reviews",
            "average_rating",
            "review_count",
            "booking_available",
        ]

    def get_services(self, landing_page):
        # Only services the owner switched on. Products are never shown here: this
        # is a service page, and clients book appointments, they don't buy stock.
        items = (
            Service.objects.for_account(landing_page.business_account)
            .filter(is_product=False, show_on_landing_page=True)
            .order_by("name")
        )
        return PublicServiceSerializer(items, many=True).data

    def get_reviews(self, landing_page):
        approved = landing_page.reviews.filter(is_approved=True)
        return PublicReviewSerializer(approved, many=True).data

    def get_average_rating(self, landing_page):
        approved = list(landing_page.reviews.filter(is_approved=True).values_list("rating", flat=True))
        return round(sum(approved) / len(approved), 1) if approved else None

    def get_review_count(self, landing_page):
        return landing_page.reviews.filter(is_approved=True).count()

    def get_hours(self, landing_page):
        rows = BusinessHours.objects.filter(business_account=landing_page.business_account).order_by("day_of_week")
        return PublicHoursSerializer(rows, many=True).data


class LandingPageSerializer(serializers.ModelSerializer):
    """The private, logged-in version — for the owner editing their own page."""

    photos = LandingPagePhotoSerializer(many=True, read_only=True)
    # The logo lives on the business account (Settings > Branding). Shown read only here,
    # so the owner can see whether it's there before picking the logo option.
    logo = serializers.ImageField(source="business_account.logo", read_only=True)
    booking_available = serializers.BooleanField(read_only=True)

    class Meta:
        model = LandingPage
        fields = [
            "id",
            "slug",
            "blurb_text",
            "landing_accent",
            "landing_background",
            "landing_font",
            "landing_corners",
            "landing_cards",
            "social_links",
            "hero_mark",
            "logo",
            "booking_enabled",
            "booking_available",
            "photos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "booking_available", "created_at", "updated_at"]  # the address is set at signup and never changes  # booking_available depends on the plan, so the owner can toggle booking_enabled but never grant themselves a plan



    def validate_social_links(self, value):
        # Runs on every save of the owner's page. Each entry is checked and
        # tidied, so the public page only ever gets clean, safe links.
        if not isinstance(value, list):
            raise serializers.ValidationError("Social links need to be a list.")
        if len(value) > len(SOCIAL_PLATFORM_LABELS):
            raise serializers.ValidationError("You've added more social links than there are networks to pick from.")

        cleaned = []
        seen = set()
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError("Each social link needs a network and a web address.")
            platform = str(item.get("platform", "")).strip()
            if platform not in SOCIAL_PLATFORM_LABELS:
                raise serializers.ValidationError("Pick a social network from the list.")
            if platform in seen:
                raise serializers.ValidationError(f"You can only add {SOCIAL_PLATFORM_LABELS[platform]} once.")

            raw_url = str(item.get("url", "")).strip()
            if not raw_url:
                raise serializers.ValidationError(f"Add the web address for {SOCIAL_PLATFORM_LABELS[platform]}.")
            if len(raw_url) > MAX_SOCIAL_URL_LENGTH:
                raise serializers.ValidationError("That web address is too long.")

            seen.add(platform)
            cleaned.append({"platform": platform, "url": _clean_social_url(raw_url)})
        return cleaned


class PublicBookingSerializer(serializers.Serializer):
    """What a visitor types into the booking form. Everything here is required,
    except the honeypot, which real visitors never see or fill in."""

    REQUIRED = {"required": "Please fill this in.", "blank": "Please fill this in."}

    service = serializers.IntegerField(error_messages={"required": "Pick a service.", "invalid": "Pick a service."})
    date = serializers.DateField(error_messages={"required": "Pick a date.", "invalid": "Pick a valid date."})
    time = serializers.RegexField(r"^\d{2}:\d{2}$", error_messages={"required": "Pick a time.", "invalid": "Pick a time."})
    first_name = serializers.CharField(max_length=255, error_messages=REQUIRED)
    last_name = serializers.CharField(max_length=255, error_messages=REQUIRED)
    email = serializers.EmailField(error_messages={"required": "Enter your email.", "blank": "Enter your email.", "invalid": "Enter a valid email address."})
    phone = serializers.CharField(max_length=32, error_messages=REQUIRED)
    address = serializers.CharField(max_length=255, error_messages=REQUIRED)
    city = serializers.CharField(max_length=255, error_messages=REQUIRED)
    state = serializers.CharField(max_length=100, error_messages=REQUIRED)
    zip_code = serializers.CharField(max_length=20, error_messages=REQUIRED)
    website = serializers.CharField(required=False, allow_blank=True, default="")  # honeypot — hidden from people, bots tend to fill it in


class PublicReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingPageReview
        fields = ["id", "author_name", "rating", "text", "created_at"]


class OwnerReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingPageReview
        fields = ["id", "author_name", "rating", "text", "is_approved", "created_at"]
        read_only_fields = fields


class PublicReviewInputSerializer(serializers.Serializer):
    """What a visitor types into the "Leave a review" form. The website field is
    the honeypot, hidden from people, and bots tend to fill it in."""

    author_name = serializers.CharField(max_length=100, error_messages={"required": "Add your name.", "blank": "Add your name."})
    rating = serializers.IntegerField(min_value=1, max_value=5, error_messages={"required": "Pick a star rating.", "invalid": "Pick a star rating.", "min_value": "Pick a star rating.", "max_value": "Pick a star rating."})
    text = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    website = serializers.CharField(required=False, allow_blank=True, default="")
