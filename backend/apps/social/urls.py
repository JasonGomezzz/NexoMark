from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    MetaCallbackView,
    MetaCompleteView,
    MetaConnectView,
    PublicationViewSet,
    SocialConnectionViewSet,
)
from .views_tiktok import (
    TikTokCallbackView,
    TikTokCompleteView,
    TikTokConfigView,
    TikTokConnectView,
    TikTokDestinosView,
    TikTokEnviarView,
    TikTokEstadoView,
)
from .views_x import (
    VarianteXViewSet,
    XCallbackView,
    XCompleteView,
    XConfigView,
    XConnectView,
    XDestinosView,
)

router = SimpleRouter()
router.register(r"connections", SocialConnectionViewSet, basename="social-connection")
router.register(r"publications", PublicationViewSet, basename="publication")
router.register(r"x-variants", VarianteXViewSet, basename="x-variant")

urlpatterns = [
    path("meta/connect/", MetaConnectView.as_view(), name="meta-connect"),
    path("meta/callback/", MetaCallbackView.as_view(), name="meta-callback"),
    path("meta/complete/", MetaCompleteView.as_view(), name="meta-complete"),
    path("x/config/", XConfigView.as_view(), name="x-config"),
    path("x/connect/", XConnectView.as_view(), name="x-connect"),
    path("x/callback/", XCallbackView.as_view(), name="x-callback"),
    path("x/complete/", XCompleteView.as_view(), name="x-complete"),
    path("x/destinos/", XDestinosView.as_view(), name="x-destinos"),
    path("tiktok/config/", TikTokConfigView.as_view(), name="tiktok-config"),
    path("tiktok/connect/", TikTokConnectView.as_view(), name="tiktok-connect"),
    path("tiktok/callback/", TikTokCallbackView.as_view(), name="tiktok-callback"),
    path("tiktok/complete/", TikTokCompleteView.as_view(), name="tiktok-complete"),
    path("tiktok/destinos/", TikTokDestinosView.as_view(), name="tiktok-destinos"),
    path("tiktok/enviar/", TikTokEnviarView.as_view(), name="tiktok-enviar"),
    path("tiktok/estado/<int:pk>/", TikTokEstadoView.as_view(), name="tiktok-estado"),
] + router.urls
