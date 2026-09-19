from django.db.models import Q

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
        # Powers the client profile's "Purchases" tab from the plan doc —
        # the frontend calls GET /api/invoicing/invoices/?client=5 to get
        # just that one client's invoice history, instead of a separate
        # endpoint just for that.
        queryset = super().get_queryset()  # this already filters to just the logged-in account's own invoices
        client_id = self.request.query_params.get("client")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

    def perform_create(self, serializer):
        # Normally TenantScopedModelViewSet.perform_create() stamps
        # `business_account=request.user` onto every new row automatically
        # (see common/views.py). We skip that here on purpose: our custom
        # InvoiceSerializer.create() already sets business_account itself
        # (it needs the account earlier anyway, to compute tax and the
        # next invoice number before the row even exists) — doing it again
        # here would just be a duplicate, conflicting argument.
        serializer.save()


class PaymentRecordViewSet(TenantScopedModelViewSet):
    queryset = PaymentRecord.objects.all()
    serializer_class = PaymentRecordSerializer


class TenderTypeViewSet(TenantScopedModelViewSet):
    """
    Slightly different from a normal tenant-scoped resource: the LIST view
    should show both the system-wide defaults (Cash, Visa, ...) AND this
    account's own custom ones — but creating a new one should only ever
    create a custom one scoped to this account (you can't add a new
    "system default" through the API).
    """

    queryset = TenderType.objects.all()
    serializer_class = TenderTypeSerializer

    def get_queryset(self):
        # Q objects let you build an "OR" condition — this reads as
        # "rows where business_account is empty (a system default) OR
        # rows that belong to me."
        return TenderType.objects.filter(
            Q(business_account__isnull=True) | Q(business_account=self.request.user)
        )

    def perform_create(self, serializer):
        serializer.save(business_account=self.request.user, is_custom=True)


class DiscountViewSet(TenantScopedModelViewSet):
    queryset = Discount.objects.all()
    serializer_class = DiscountSerializer
