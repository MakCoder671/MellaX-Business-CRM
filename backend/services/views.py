from common.views import TenantScopedModelViewSet

from .models import Service
from .serializers import ServiceSerializer


class ServiceViewSet(TenantScopedModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
