from common.views import TenantScopedModelViewSet

from .models import Discount, Invoice, PaymentRecord, TenderType
from .serializers import (
    DiscountSerializer,
    InvoiceSerializer,
    PaymentRecordSerializer,
    TenderTypeSerializer,
)


class InvoiceViewSet(TenantScopedModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        # Backs the client profile's "Purchases" tab (business_plan.MD,
        # Basic Plan): ?client=<id> scopes to one client's invoice history.
        queryset = super().get_queryset()
        client_id = self.request.query_params.get("client")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

    def perform_create(self, serializer):
        # InvoiceSerializer.create() already sets business_account from
        # request context (it also needs it to compute tax/invoice number
        # before the row exists), so don't inject it a second time here.
        serializer.save()


class PaymentRecordViewSet(TenantScopedModelViewSet):
    queryset = PaymentRecord.objects.all()
    serializer_class = PaymentRecordSerializer


class TenderTypeViewSet(TenantScopedModelViewSet):
    """Read-only list of system defaults plus the account's own custom
    tender types; creation only adds custom ones scoped to the account."""

    queryset = TenderType.objects.all()
    serializer_class = TenderTypeSerializer

    def get_queryset(self):
        from django.db.models import Q

        return TenderType.objects.filter(
            Q(business_account__isnull=True) | Q(business_account=self.request.user)
        )

    def perform_create(self, serializer):
        serializer.save(business_account=self.request.user, is_custom=True)


class DiscountViewSet(TenantScopedModelViewSet):
    queryset = Discount.objects.all()
    serializer_class = DiscountSerializer
