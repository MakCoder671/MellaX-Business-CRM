from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    ExpenseCategoriesView,
    ExpenseViewSet,
    ExportView,
    GrowthView,
    MonthlySeriesView,
    OtherIncomeViewSet,
    ProfitLossView,
    RecurringExpenseViewSet,
    TaxPacketView,
    RevenueByClientView,
    RevenueByItemView,
    TaxQuarterView,
    TaxYearView,
)

# Mounted at /api/reports/ in mellax/urls.py.
router = SimpleRouter()
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("recurring-expenses", RecurringExpenseViewSet, basename="recurring-expense")
router.register("other-income", OtherIncomeViewSet, basename="other-income")

urlpatterns = [
    path("profit-loss/", ProfitLossView.as_view(), name="profit-loss"),
    path("revenue-by-item/", RevenueByItemView.as_view(), name="revenue-by-item"),
    path("revenue-by-client/", RevenueByClientView.as_view(), name="revenue-by-client"),
    path("expense-categories/", ExpenseCategoriesView.as_view(), name="expense-categories"),
    path("growth/", GrowthView.as_view(), name="growth"),
    path("monthly/", MonthlySeriesView.as_view(), name="monthly"),
    path("tax/year/", TaxYearView.as_view(), name="tax-year"),
    path("tax/quarters/", TaxQuarterView.as_view(), name="tax-quarters"),
    path("tax/packet/", TaxPacketView.as_view(), name="tax-packet"),
    path("export/<str:kind>/", ExportView.as_view(), name="export"),
] + router.urls
