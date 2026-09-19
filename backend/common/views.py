from rest_framework import permissions, viewsets

# ----------------------------------------------------------------------------
# A "ViewSet" in Django REST Framework is a class that automatically wires
# up all the standard CRUD endpoints for a model: list, retrieve, create,
# update, delete. Instead of writing five separate views per model, you
# write one ViewSet and a router (see each app's urls.py) generates all
# the URL patterns for you.
#
# This file defines a base ViewSet that every "tenant-owned" resource
# (Client, Service, Invoice, etc.) can inherit from, so the tenant-scoping
# rule from common/models.py actually gets ENFORCED at the API layer —
# not just available if someone remembers to use it.
# ----------------------------------------------------------------------------


class TenantScopedModelViewSet(viewsets.ModelViewSet):
    """
    Base viewset for anything that belongs to a single business account.

    The key trick is `get_queryset()`: DRF calls this every time it needs
    to look up rows (for list, retrieve, update, delete). By always
    restricting it to `self.request.user`'s own rows, a request for
    someone else's data (e.g. GET /api/clients/999/ where 999 belongs to
    a different business) just returns a normal 404 "not found" — instead
    of leaking that the row exists, or worse, returning it.
    """

    permission_classes = [permissions.IsAuthenticated]  # you must be logged in to use this at all

    def get_queryset(self):
        # self.queryset.model grabs the actual model class (e.g. Client)
        # off whatever queryset the subclass declared, then we use OUR
        # tenant-scoped manager to filter it down to just this account's rows.
        return self.queryset.model.objects.for_account(self.request.user)

    def perform_create(self, serializer):
        # Whenever something new gets created through this viewset (a POST
        # request), automatically stamp it with the logged-in user's
        # account. This means the frontend never has to send
        # "business_account" in the request body — and even if it tried
        # to, we wouldn't use it, so nobody can create a row under
        # someone else's account by accident (or on purpose).
        serializer.save(business_account=self.request.user)
