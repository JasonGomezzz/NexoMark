"""
MarketMind IA — Authentication URLs
Monta los endpoints de auth bajo el prefijo /api/auth/
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import AuthBrandContentView, ChangePasswordView, LogoutView, MeView, RegisterView
from .credit_views import MyCreditRequestsView
from .email_change import EmailChangeConfirmView, EmailChangeView
from .password_reset import PasswordResetConfirmView, PasswordResetRequestView
from .profile_avatar import MyAvatarView
from .token_views import CustomTokenObtainPairView

urlpatterns = [
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

    # Foto de perfil (se sube con PATCH me/ multipart) y cambio de correo con doble confirmación
    path("me/avatar/", MyAvatarView.as_view(), name="auth-avatar"),
    path("me/change-email/", EmailChangeView.as_view(), name="auth-change-email"),
    path("email-change/confirm/", EmailChangeConfirmView.as_view(), name="auth-change-email-confirm"),

    # Recuperación de contraseña por correo (enlace de un solo uso)
    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),

    # Solicitudes de créditos del marketero (las resuelve el superadmin)
    path("credit-requests/", MyCreditRequestsView.as_view(), name="auth-credit-requests"),

    # Contenido público para panel Login/Register
    path("brand-content/", AuthBrandContentView.as_view(), name="auth-brand-content"),
]
