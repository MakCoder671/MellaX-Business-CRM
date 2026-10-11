from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DiscountViewSet, InvoiceViewSet, PaymentRecordViewSet, TenderTypeViewSet

# One router, four resources — this is what makes the final URLs look like:
#   /api/invoicing/invoices/
#   /api/invoicing/payments/
#   /api/invoicing/tender-types/
#   /api/invoicing/discounts/
# (the /api/invoicing/ prefix gets added when this file is included in
# mellax/urls.py)

router = DefaultRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentRecordViewSet, basename="payment")
router.register("tender-types", TenderTypeViewSet, basename="tender-type")
router.register("discounts", DiscountViewSet, basename="discount")

from .card_views import (  # noqa: E402
    InvoiceCardPaymentConfirmView,
    InvoiceCardPaymentView,
    PaymentRefundView,
    StripeConfigView,
)
from .views import InvoicePreviewView  # noqa: E402

# The preview route is listed before the router so "preview" isn't read as an invoice id.
urlpatterns = [
    path("invoices/preview/", InvoicePreviewView.as_view(), name="invoice-preview"),
    path("stripe/config/", StripeConfigView.as_view(), name="stripe-config"),
    path("invoices/<int:pk>/card-payment/", InvoiceCardPaymentView.as_view(), name="card-payment"),
    path("invoices/<int:pk>/card-payment/confirm/", InvoiceCardPaymentConfirmView.as_view(), name="card-payment-confirm"),
    path("payments/<int:pk>/stripe-refund/", PaymentRefundView.as_view(), name="stripe-refund"),
] + router.urls
