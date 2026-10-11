from django.urls import path

from .views import IntegrationConnectView, IntegrationDetailView, IntegrationDisconnectView, IntegrationListView

# Mounted at /api/integrations/ in mellax/urls.py.
urlpatterns = [
    path("", IntegrationListView.as_view(), name="integration-list"),
    path("<str:key>/", IntegrationDetailView.as_view(), name="integration-detail"),
    path("<str:key>/connect/", IntegrationConnectView.as_view(), name="integration-connect"),
    path("<str:key>/disconnect/", IntegrationDisconnectView.as_view(), name="integration-disconnect"),
]
