from common.views import TenantScopedModelViewSet

from .models import Service
from .serializers import ServiceSerializer

# Same shape as clients/views.py — see the comments there for how
# TenantScopedModelViewSet does the heavy lifting.


class ServiceViewSet(TenantScopedModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
