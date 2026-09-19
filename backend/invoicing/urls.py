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

urlpatterns = router.urls
