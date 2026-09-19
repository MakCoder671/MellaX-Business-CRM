from django.urls import path

from .views import ProfitLossView

urlpatterns = [
    path("profit-loss/", ProfitLossView.as_view(), name="profit-loss"),
]
