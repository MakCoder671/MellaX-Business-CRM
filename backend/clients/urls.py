from rest_framework.routers import DefaultRouter

from .views import ClientViewSet

# ----------------------------------------------------------------------------
# A DRF "router" looks at a ViewSet and automatically generates all the
# list/create/retrieve/update/delete URL patterns for it, instead of us
# writing each `path(...)` by hand like in accounts/urls.py.
# ----------------------------------------------------------------------------

router = DefaultRouter()
router.register("", ClientViewSet, basename="client")

urlpatterns = router.urls
