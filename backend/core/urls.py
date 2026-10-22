from django.conf import settings
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path

from apps.authentication.admin_views import (
    AdminResetQuotaView,
    AdminUserDetailView,
    AdminUsersListView,
)
from apps.authentication.credit_views import AdminCreditRequestDetailView, AdminCreditRequestListView
from apps.campaigns.views import AdminAnalyticsView
from apps.social.views import InternalApprovedEventView, PublicMediaView
from apps.social.views_tiktok import TikTokVerificacionView


def health(request):
    """Keep-alive para cron-job.org.

    Ejecuta SELECT 1 para despertar/mantener viva la compute de Neon, que
    n8n y Spring Boot comparten. SIEMPRE responde HTTP 200: si la query
    falla (Neon despertando), igual reportamos ok con db='waking' para que
    cron-job.org no marque fallo — el intento de conexion ya gatilla el wake.
    """
    db_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        db_status = "waking"
    return JsonResponse({"status": "ok", "db": db_status})


urlpatterns = [
    path('api/health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/campaigns/', include('apps.campaigns.urls')),
    path('api/intents/', include('apps.campaigns.intent_urls')),
    path('api/social/', include('apps.social.urls')),
    path('api/public/media/<str:token>.jpg', PublicMediaView.as_view(), name='public-media'),
    path('api/public/media/<str:archivo>.txt', TikTokVerificacionView.as_view(), name='tiktok-verificacion'),
    path('api/internal/campaign-events/approved', InternalApprovedEventView.as_view(), name='internal-approved'),
    path('api/admin/analytics/', AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('api/admin/users/', AdminUsersListView.as_view(), name='admin-users-list'),
    path('api/admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-users-detail'),
    path('api/admin/users/<int:pk>/reset-quota/', AdminResetQuotaView.as_view(), name='admin-users-reset-quota'),
    path('api/admin/credit-requests/', AdminCreditRequestListView.as_view(), name='admin-credit-requests'),
    path('api/admin/credit-requests/<int:pk>/', AdminCreditRequestDetailView.as_view(), name='admin-credit-requests-detail'),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
