from rest_framework.routers import DefaultRouter

from .views import ProductViewSet

# Separate from services/urls.py on purpose — Products live at their own
# /api/products/ prefix, even though it's the exact same Service model
# underneath (see services/models.py and ProductViewSet in
# services/views.py, which is what actually keeps this scoped to just
# the is_product=True rows).

router = DefaultRouter()
router.register("", ProductViewSet, basename="product")

urlpatterns = router.urls
