from django.db import models
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.response import Response

from common.permissions import IsPlusOrAbove
from common.views import TenantScopedModelViewSet

from .models import Campaign, Lead
from .serializers import (
    CampaignSerializer,
    LeadSerializer,
    PublicCampaignSerializer,
    PublicLeadCreateSerializer,
)

# ----------------------------------------------------------------------------
# This file has two very different audiences:
#   - CampaignViewSet / LeadViewSet: the business owner's dashboard,
#     logged in, Plus-plan only.
#   - PublicCampaignView / PublicLeadCreateView: a random visitor who
#     clicked a link or scanned a QR code — no login, no plan check, and
#     deliberately unable to see anything except the one campaign/business
#     name tied to the link they used.
# ----------------------------------------------------------------------------


class CampaignViewSet(TenantScopedModelViewSet):
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer
    permission_classes = [permissions.IsAuthenticated, IsPlusOrAbove]


class LeadViewSet(TenantScopedModelViewSet):
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated, IsPlusOrAbove]

    def get_queryset(self):
        # Mirrors InvoiceViewSet's ?client=<id> filter (invoicing/views.py)
        # — lets the dashboard ask for just one campaign's leads via
        # ?campaign=<id> instead of always getting every lead across
        # every campaign.
        queryset = super().get_queryset()
        campaign_id = self.request.query_params.get("campaign")
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
        return queryset


class PublicCampaignView(generics.RetrieveAPIView):
    """
    GET /api/campaigns/public/<slug>/ — the page a link click or QR scan
    actually lands on. Every hit here counts as either a click or a scan
    (see the get() override below) before handing back just enough info
    to render the public lead-capture form.
    """

    serializer_class = PublicCampaignSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "share_link_slug"
    lookup_url_kwarg = "slug"
    queryset = Campaign.objects.all()

    def get(self, request, *args, **kwargs):
        campaign = self.get_object()

        # The QR code encodes the link with ?src=qr on the end (see
        # Campaign._generate_qr_code in campaigns/models.py) — a plain
        # shared link has no such parameter. That one query string is the
        # entire difference between "click" and "scan" as far as this
        # view is concerned.
        if request.query_params.get("src") == "qr":
            campaign.qr_scan_count = models.F("qr_scan_count") + 1
        else:
            campaign.click_count = models.F("click_count") + 1
        campaign.save(update_fields=["qr_scan_count", "click_count"])
        # models.F(...) tells the database to do "current value + 1"
        # itself, atomically — safer than reading the count into Python,
        # adding 1, and saving it back, which could lose a count if two
        # people hit the link at the exact same moment. The trade-off:
        # after save(), campaign.qr_scan_count is still the F() expression
        # object in memory, not the real new number — refresh_from_db()
        # pulls the actual post-increment values back before we serialize.
        campaign.refresh_from_db()

        return Response(self.get_serializer(campaign).data)


class PublicLeadCreateView(generics.CreateAPIView):
    """
    POST /api/campaigns/public/<slug>/leads/ — the lead-capture form
    submits here. Write-only from the public side: it can create exactly
    one Lead, tied to exactly the one campaign named in the URL, and
    nothing else about the business is reachable through this endpoint.
    """

    serializer_class = PublicLeadCreateSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        campaign = get_object_or_404(Campaign, share_link_slug=self.kwargs["slug"])
        # business_account comes from the campaign itself, not from
        # anything the visitor could submit — there's no way for a public
        # request to create a Lead under an account it doesn't already
        # know the campaign slug for.
        serializer.save(campaign=campaign, business_account=campaign.business_account)
