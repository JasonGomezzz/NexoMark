"""
MarketMind IA — Authentication URLs
Monta los endpoints de auth bajo el prefijo /api/auth/
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AuthBrandContentView, ChangePasswordView, LogoutView, MeView, RegisterView
from .token_views import CustomTokenObtainPairView
from .password_reset import PasswordResetRequestView, PasswordResetConfirmView
from .email_change import EmailChangeView, EmailChangeConfirmView
from .instagram import InstagramAccountsView, InstagramConnectView, InstagramCompleteView, InstagramDisconnectView
from .facebook import FacebookPagesView, FacebookConnectView, FacebookCompleteView, FacebookDisconnectView, FacebookCallbackRelayView
from .x_oauth import XAccountsView, XConnectView, XDisconnectView, XCallbackView
from .tiktok import TikTokAccountsView, TikTokConnectView, TikTokCompleteView, TikTokDisconnectView, TikTokCallbackView

urlpatterns = [
    path('me/change-email/', EmailChangeView.as_view(), name='auth-change-email'),
    path('email-change/confirm/', EmailChangeConfirmView.as_view(), name='auth-change-email-confirm'),
    path('tiktok/accounts/', TikTokAccountsView.as_view()),
    path('tiktok/accounts/<int:pk>/', TikTokDisconnectView.as_view()),
    path('tiktok/connect/', TikTokConnectView.as_view()),
    path('tiktok/complete/', TikTokCompleteView.as_view()),
    path('tiktok/callback/', TikTokCallbackView.as_view()),
    path('x/accounts/', XAccountsView.as_view()),
    path('x/accounts/<int:pk>/', XDisconnectView.as_view()),
    path('x/connect/', XConnectView.as_view()),
    path('x/callback/', XCallbackView.as_view()),
    path('facebook/pages/', FacebookPagesView.as_view()),
    path('facebook/pages/<int:pk>/', FacebookDisconnectView.as_view()),
    path('facebook/connect/', FacebookConnectView.as_view()),
    path('facebook/complete/', FacebookCompleteView.as_view()),
    path('facebook/callback/', FacebookCallbackRelayView.as_view()),
    path('instagram/accounts/', InstagramAccountsView.as_view()),
    path('instagram/accounts/<int:pk>/', InstagramDisconnectView.as_view()),
    path('instagram/connect/', InstagramConnectView.as_view()),
    path('instagram/complete/', InstagramCompleteView.as_view()),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    # HU1: Registro de usuarios
    path("register/", RegisterView.as_view(), name="auth-register"),

    # HU2: Login → access_token + refresh_token + role
    path("token/", CustomTokenObtainPairView.as_view(), name="auth-token"),

    # HU2: Refresh del access token
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),

    # Logout con blacklist del refresh token
    path("logout/", LogoutView.as_view(), name="auth-logout"),

    # HU8: datos del usuario autenticado en tiempo real (tokens_disponibles)
    # GET = perfil · PATCH = editar nombre (Settings)
    path("me/", MeView.as_view(), name="auth-me"),

    # Settings: cambio de contraseña del propio usuario
    path("me/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),

    # Contenido público para panel Login/Register
    path("brand-content/", AuthBrandContentView.as_view(), name="auth-brand-content"),
]
