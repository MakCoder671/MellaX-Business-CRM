from common.views import TenantScopedModelViewSet

from .models import Client, ClientNote
from .serializers import ClientNoteSerializer, ClientSerializer

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


class ClientNoteViewSet(TenantScopedModelViewSet):
    queryset = ClientNote.objects.all()
    serializer_class = ClientNoteSerializer

    def get_queryset(self):
        # The Notes tab on a client's profile calls
        # GET /api/clients/notes/?client=5 to get just that client's notes.
        queryset = super().get_queryset()
        client_id = self.request.query_params.get("client")
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset
