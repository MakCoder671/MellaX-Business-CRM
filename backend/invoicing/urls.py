from rest_framework.routers import DefaultRouter

from .views import DiscountViewSet, InvoiceViewSet, PaymentRecordViewSet, TenderTypeViewSet

router = DefaultRouter()
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("payments", PaymentRecordViewSet, basename="payment")
router.register("tender-types", TenderTypeViewSet, basename="tender-type")
router.register("discounts", DiscountViewSet, basename="discount")

urlpatterns = router.urls
