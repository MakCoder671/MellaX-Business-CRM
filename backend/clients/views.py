from common.views import TenantScopedModelViewSet

from .models import Client
from .serializers import ClientSerializer


class ClientViewSet(TenantScopedModelViewSet):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
