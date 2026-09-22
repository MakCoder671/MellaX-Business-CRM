from datetime import timedelta

from django.db.models import F, Q
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response

from common.views import TenantScopedModelViewSet

from .models import Service
from .serializers import ServiceSerializer

# Same shape as clients/views.py — see the comments there for how
# TenantScopedModelViewSet does the heavy lifting. Products and Services
# share the exact same model (see services/models.py) — these two
# ViewSets just each scope to their own half of it (is_product True vs
# False) so the two tabs never see each other's rows, and so creating
# through one tab can't accidentally create a row that shows up on the
# other.


class ServiceViewSet(TenantScopedModelViewSet):
    queryset = Service.objects.filter(is_product=False)
    serializer_class = ServiceSerializer

    def get_queryset(self):
        return super().get_queryset().filter(is_product=False)

    def perform_create(self, serializer):
        serializer.save(business_account=self.request.user, is_product=False)


class ProductViewSet(TenantScopedModelViewSet):
    queryset = Service.objects.filter(is_product=True)
    serializer_class = ServiceSerializer

    def get_queryset(self):
        return super().get_queryset().filter(is_product=True)

    def perform_create(self, serializer):
        serializer.save(business_account=self.request.user, is_product=True)

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """
        GET /api/products/low-stock/ — every product this account has
        that's at or below its own warning threshold and hasn't been
        snoozed or dismissed (or whose snooze has since expired). This
        is what the dashboard checks once on load to decide whether to
        pop up a low-stock warning at all.
        """
        now = timezone.now()
        products = (
            self.get_queryset()
            .filter(
                stock_quantity__isnull=False,
                low_stock_threshold__isnull=False,
                low_stock_dismissed=False,
                stock_quantity__lte=F("low_stock_threshold"),
            )
            .filter(Q(low_stock_snoozed_until__isnull=True) | Q(low_stock_snoozed_until__lte=now))
        )
        return Response(ServiceSerializer(products, many=True).data)

    @action(detail=True, methods=["post"])
    def snooze(self, request, pk=None):
        """
        POST /api/products/<id>/snooze/ — "Remind me later" on the
        low-stock popup. Body: {"minutes": 60}. Stops this one product's
        warning from showing again until that much time has passed.
        """
        product = self.get_object()
        try:
            minutes = int(request.data.get("minutes", 60))
        except (TypeError, ValueError):
            minutes = 60
        product.low_stock_snoozed_until = timezone.now() + timedelta(minutes=minutes)
        product.save(update_fields=["low_stock_snoozed_until"])
        return Response(ServiceSerializer(product).data)

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        """
        POST /api/products/<id>/dismiss/ — "Dismiss" on the low-stock
        popup. Stops this one product's warning entirely until it's
        restocked back above the threshold and dips low again later
        (see Service.save()).
        """
        product = self.get_object()
        product.low_stock_dismissed = True
        product.save(update_fields=["low_stock_dismissed"])
        return Response(ServiceSerializer(product).data)
