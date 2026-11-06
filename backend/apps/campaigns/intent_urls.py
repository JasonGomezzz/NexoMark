from rest_framework.routers import SimpleRouter

from .intent_views import CampaignIntentViewSet

router = SimpleRouter()
router.register(r"", CampaignIntentViewSet, basename="intent")

urlpatterns = router.urls
