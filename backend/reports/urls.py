from django.urls import path

from .views import ProfitLossView, RevenueByClientView, RevenueByItemView

urlpatterns = [
    path("profit-loss/", ProfitLossView.as_view(), name="profit-loss"),
    path("revenue-by-item/", RevenueByItemView.as_view(), name="revenue-by-item"),
    path("revenue-by-client/", RevenueByClientView.as_view(), name="revenue-by-client"),
]
