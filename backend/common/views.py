from rest_framework import permissions, viewsets


class TenantScopedModelViewSet(viewsets.ModelViewSet):
    """Base viewset for every tenant-owned resource.

    get_queryset() is always restricted to the requesting account, so a
    client-supplied pk for another account's row 404s instead of leaking
    (business_plan.MD, Account Creation & Security, principle 3).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.model.objects.for_account(self.request.user)

    def perform_create(self, serializer):
        serializer.save(business_account=self.request.user)
