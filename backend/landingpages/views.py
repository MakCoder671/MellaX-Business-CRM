from rest_framework import generics, permissions

from .models import LandingPage
from .serializers import LandingPageSerializer, PublicLandingPageSerializer


class MyLandingPageView(generics.RetrieveUpdateAPIView):
    """Authenticated: the logged-in account managing its own page."""

    serializer_class = LandingPageSerializer

    def get_object(self):
        landing_page, _ = LandingPage.objects.get_or_create(
            business_account=self.request.user,
            defaults={"slug": f"business-{self.request.user.pk}"},
        )
        return landing_page


class PublicLandingPageView(generics.RetrieveAPIView):
    """Public, read-only, unauthenticated — the only landing-page endpoint
    the outside world can reach (business_plan.MD, Account Creation &
    Security, principle 5). Deliberately a separate view/serializer from
    the authenticated dashboard API, not just a permission toggle on it."""

    serializer_class = PublicLandingPageSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return LandingPage.objects.all()
