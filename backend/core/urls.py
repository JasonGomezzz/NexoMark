from django.conf import settings
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from apps.campaigns.tiktok_webhooks import TikTokWebhookView

from apps.authentication.admin_views import (
    AdminResetQuotaView,
    AdminUserDetailView,
    AdminUsersListView,
)
from apps.campaigns.views import AdminAnalyticsView
from apps.authentication.credit_views import CreditRequestListView, AdminCreditRequestListView, AdminCreditRequestDetailView


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
    path('api/tiktok/webhook/', TikTokWebhookView.as_view()),
    path('api/auth/credit-requests/', CreditRequestListView.as_view()),
    path('api/admin/credit-requests/', AdminCreditRequestListView.as_view()),
    path('api/admin/credit-requests/<int:pk>/', AdminCreditRequestDetailView.as_view()),
    path('api/health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/intents/', include('apps.campaigns.intent_urls')),
    path('api/campaigns/', include('apps.campaigns.urls')),
    path('api/admin/analytics/', AdminAnalyticsView.as_view(), name='admin-analytics'),
    path('api/admin/users/', AdminUsersListView.as_view(), name='admin-users-list'),
    path('api/admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-users-detail'),
    path('api/admin/users/<int:pk>/reset-quota/', AdminResetQuotaView.as_view(), name='admin-users-reset-quota'),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
