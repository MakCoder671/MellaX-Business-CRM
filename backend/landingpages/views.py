from rest_framework import generics, permissions

from .models import LandingPage
from .serializers import LandingPageSerializer, PublicLandingPageSerializer


class MyLandingPageView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/landing-pages/me/ — the logged-in account managing its own page."""

    serializer_class = LandingPageSerializer

    def get_object(self):
        # Every account should have exactly one landing page, auto-created
        # the first time they ever look at it (rather than needing a
        # separate "create your landing page" step during onboarding —
        # one less thing to remember to wire up).
        landing_page, _ = LandingPage.objects.get_or_create(
            business_account=self.request.user,
            defaults={"slug": f"business-{self.request.user.pk}"},
        )
        return landing_page


class PublicLandingPageView(generics.RetrieveAPIView):
    """
    GET /api/landing-pages/public/<slug>/ — the ONLY landing-page endpoint
    the outside world (no login) can reach. This is a deliberately
    separate view + serializer from the authenticated one above, not the
    same view with a permission check toggled off — see the comment at
    the top of serializers.py for why that separation matters.
    """

    serializer_class = PublicLandingPageSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"  # look this up by its slug in the URL, not by numeric ID

    def get_queryset(self):
        return LandingPage.objects.all()
