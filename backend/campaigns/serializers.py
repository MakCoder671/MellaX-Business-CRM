from django.conf import settings
from rest_framework import serializers

from .models import Campaign, Lead

# ----------------------------------------------------------------------------
# Same split as landingpages/serializers.py: authenticated serializers for
# the business owner's dashboard, and separate PUBLIC ones for the
# anonymous link/QR visitor — never the same serializer with permissions
# toggled, so it's structurally impossible for a public request to
# accidentally see private data.
# ----------------------------------------------------------------------------


class CampaignSerializer(serializers.ModelSerializer):
    conversion_rate = serializers.SerializerMethodField()
    lead_count = serializers.IntegerField(source="leads.count", read_only=True)
    share_link = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "cost",
            "details",
            "share_link_slug",
            "share_link",
            "click_count",
            "qr_scan_count",
            "qr_code_image",
            "lead_count",
            "conversion_rate",
            "created_at",
        ]
        # click_count/qr_scan_count/qr_code_image are all set by the
        # backend (see campaigns/models.py and views.py's PublicCampaignView)
        # — never something the frontend sends directly.
        read_only_fields = [
            "id",
            "share_link_slug",
            "click_count",
            "qr_scan_count",
            "qr_code_image",
            "created_at",
        ]

    def get_conversion_rate(self, campaign):
        return campaign.conversion_rate()

    def get_share_link(self, campaign):
        return f"{settings.FRONTEND_URL}/c/{campaign.share_link_slug}/"


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            "id",
            "campaign",
            "name",
            "phone",
            "email",
            "interested_in",
            "message",
            "status",
            "created_at",
        ]
        # A lead's contact details came from the public form that created
        # it — only its status (new/contacted/converted) is meant to be
        # edited afterward, from the dashboard.
        read_only_fields = ["id", "campaign", "name", "phone", "email", "interested_in", "message", "created_at"]


class PublicCampaignSerializer(serializers.ModelSerializer):
    """What the anonymous link/QR visitor sees — just enough to know
    whose form they're filling out, nothing about the campaign's own
    performance numbers or cost."""

    business_name = serializers.CharField(source="business_account.business_name")

    class Meta:
        model = Campaign
        fields = ["name", "business_name"]


class PublicLeadCreateSerializer(serializers.ModelSerializer):
    """Write-only from the public side — creates a Lead, nothing else.
    business_account and campaign both get set by the view from the URL's
    slug, not from anything the visitor submits (see
    campaigns/views.py's PublicLeadCreateView)."""

    class Meta:
        model = Lead
        fields = ["name", "phone", "email", "interested_in", "message"]

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError("Please provide an email or phone number.")
        return attrs
