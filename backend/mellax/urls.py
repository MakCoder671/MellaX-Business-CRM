from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/clients/", include("clients.urls")),
    path("api/services/", include("services.urls")),
    path("api/invoicing/", include("invoicing.urls")),
    path("api/scheduling/", include("scheduling.urls")),
    path("api/landing-pages/", include("landingpages.urls")),
    path("api/reports/", include("reports.urls")),
]
