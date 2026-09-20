from rest_framework.permissions import BasePermission

# ----------------------------------------------------------------------------
# business_plan.MD's Settings section says Plus-only fields must be
# "gated server-side by plan tier — a Basic account shouldn't be able to
# reach these fields even by direct URL/API access." This is that gate,
# written once here so any Plus-only feature (Campaigns today, maybe
# Document Creator or Merchant Integration later) can reuse it instead of
# each one writing its own plan-tier check slightly differently.
# ----------------------------------------------------------------------------


class IsPlusOrAbove(BasePermission):
    message = "This feature requires the Plus plan."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.plan_tier in (
            "plus",
            "premium",
        )
