from django.contrib import admin
from django.urls import include, path

# ----------------------------------------------------------------------------
# The top-level URL router for the whole project. Django checks these
# patterns top to bottom for every incoming request.
#
# `include(...)` hands off everything AFTER the matched prefix to that
# app's own urls.py — e.g. a request to /api/clients/42/ matches the
# "api/clients/" line below, then clients/urls.py takes it from there and
# figures out "42" means "retrieve client with id=42."
# ----------------------------------------------------------------------------

urlpatterns = [
    path("admin/", admin.site.urls),  # Django's built-in admin site
    path("api/accounts/", include("accounts.urls")),
    path("api/clients/", include("clients.urls")),
    path("api/services/", include("services.urls")),
    path("api/invoicing/", include("invoicing.urls")),
    path("api/scheduling/", include("scheduling.urls")),
    path("api/landing-pages/", include("landingpages.urls")),
    path("api/reports/", include("reports.urls")),
]
