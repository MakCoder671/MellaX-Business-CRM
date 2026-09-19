from common.views import TenantScopedModelViewSet

from .models import Client
from .serializers import ClientSerializer

# ----------------------------------------------------------------------------
# This is about as small as a ViewSet gets — because all the real logic
# (tenant scoping, permissions) already lives in TenantScopedModelViewSet
# (see common/views.py). We just tell it which model + serializer to use,
# and it generates the full set of REST endpoints:
#
#   GET    /api/clients/          -> list this account's clients
#   POST   /api/clients/          -> create a new client
#   GET    /api/clients/<id>/     -> retrieve one client
#   PUT    /api/clients/<id>/     -> replace a client
#   PATCH  /api/clients/<id>/     -> partially update a client
#   DELETE /api/clients/<id>/     -> delete a client
#
# (The actual routes get wired up in urls.py using a DRF "router".)
# ----------------------------------------------------------------------------


class ClientViewSet(TenantScopedModelViewSet):
    queryset = Client.objects.all()  # DRF needs this to figure out the model; get_queryset() actually filters it
    serializer_class = ClientSerializer
