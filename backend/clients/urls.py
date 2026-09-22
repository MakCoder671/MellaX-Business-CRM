from rest_framework.routers import DefaultRouter

from .views import ClientNoteViewSet, ClientViewSet

# ----------------------------------------------------------------------------
# A DRF "router" looks at a ViewSet and automatically generates all the
# list/create/retrieve/update/delete URL patterns for it, instead of us
# writing each `path(...)` by hand like in accounts/urls.py.
#
# "notes" has to be registered BEFORE the empty "" prefix — ClientViewSet's
# own detail route (^(?P<pk>[^/.]+)/$) would otherwise swallow a request to
# /api/clients/notes/ by matching "notes" as if it were a client's pk,
# since Django tries url patterns in the order they're registered.
# ----------------------------------------------------------------------------

router = DefaultRouter()
router.register("notes", ClientNoteViewSet, basename="client-note")
router.register("", ClientViewSet, basename="client")

urlpatterns = router.urls
