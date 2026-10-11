from rest_framework.routers import DefaultRouter

from .views import EBlastViewSet, MarketingTemplateViewSet

# Because EBlastViewSet has that @action(detail=True, ...) method named
# "send", the router automatically also wires up:
#   POST /api/marketing/eblasts/<id>/send/
# alongside the normal list/create/retrieve/delete routes — no extra
# code needed here for that.

router = DefaultRouter()
router.register("eblasts", EBlastViewSet, basename="eblast")
router.register("templates", MarketingTemplateViewSet, basename="marketing-template")

urlpatterns = router.urls
