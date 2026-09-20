from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CampaignViewSet, LeadViewSet, PublicCampaignView, PublicLeadCreateView

router = DefaultRouter()
router.register("campaigns", CampaignViewSet, basename="campaign")
router.register("leads", LeadViewSet, basename="lead")

urlpatterns = router.urls + [
    # The public, unauthenticated routes a link click or QR scan actually
    # hits — kept as explicit hand-written paths (not part of the router
    # above) since they're a completely different kind of endpoint, not
    # more CRUD on the same resource.
    path("public/<slug:slug>/", PublicCampaignView.as_view(), name="public-campaign"),
    path("public/<slug:slug>/leads/", PublicLeadCreateView.as_view(), name="public-lead-create"),
]
