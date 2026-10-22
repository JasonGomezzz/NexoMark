"""Entrar con Google: ID token verificado, ticket de un solo uso y reglas de cuenta."""

import re
import time
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication import password_reset
from apps.authentication.models import GoogleLoginTicket, User

pytestmark = pytest.mark.django_db
CHALLENGE = "/api/auth/google/challenge/"
COMPLETE = "/api/auth/google/complete/"
WEB = "test-web.apps.googleusercontent.com"
IOS = "test-ios.apps.googleusercontent.com"
ORIGEN = {"HTTP_ORIGIN": "http://frontend.test"}


@pytest.fixture(scope="module")
def clave():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_configurado(settings, clave, monkeypatch):
    settings.GOOGLE_CLIENT_ID = WEB
    settings.GOOGLE_CLIENT_IDS_NATIVOS = [IOS]
    settings.CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    monkeypatch.setattr(password_reset, "_iniciar_hilo", password_reset.procesar_solicitud)
    with patch(
        "apps.authentication.google_login.google_keys.get_signing_key_from_jwt",
        return_value=SimpleNamespace(key=clave.public_key()),
    ):
        yield


def challenge(purpose="login", role=None, **headers):
    datos = {"purpose": purpose}
    if role is not None:
        datos["role"] = role
    response = APIClient().post(CHALLENGE, datos, format="json", **(headers or ORIGEN))
    assert response.status_code == 200, response.data
    return response.data["data"]


def credencial(ticket, key, **cambios):
    claims = {
        "iss": "https://accounts.google.com",
        "sub": "google-id-123",
        "aud": WEB,
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
        "email": "nuevo@gmail.com",
        "email_verified": True,
        "nonce": ticket["nonce"],
        "name": "Nombre Google",
    }
    claims.update(cambios)
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "k1"})


def completar(ticket, key, claims=None, password=None, **headers):
    datos = {"ticket": ticket["ticket"], "proof": ticket["proof"], "credential": credencial(ticket, key, **(claims or {}))}
    if password:
        datos["current_password"] = password
    return APIClient().post(COMPLETE, datos, format="json", **(headers or ORIGEN))


@pytest.mark.parametrize("rol", ["marketero", "cliente"])
def test_registro_y_luego_login_conserva_rol_y_correo_local(clave, rol):
    response = completar(challenge("register", rol), clave)
    assert response.status_code == 200
    assert response.data["role"] == rol
    assert response.data["nombre"] == "Nombre Google"
    user = User.objects.get(google_subject="google-id-123")
    assert not user.has_usable_password()
    assert user.tokens_disponibles == 100

    cliente_http = APIClient()
    cliente_http.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    me = cliente_http.get("/api/auth/me/").data["data"]["user"]
    assert me["google_connected"] is True and me["has_password"] is False
    assert "google_subject" not in me

    # El `sub` identifica la cuenta, no el correo (que puede cambiar en cualquiera de los dos lados).
    user.email = "otro-local@example.com"
    user.save(update_fields=["email"])
    vuelve = completar(challenge(), clave, {"email": "cambiado@gmail.com"})
    assert vuelve.status_code == 200
    assert vuelve.data["email"] == "otro-local@example.com"
    assert User.objects.count() == 1


def test_app_nativa_sin_origin_y_audiencia_ios(clave):
    """Una app no envía Origin; su ID token puede traer el client ID de iOS como audiencia."""
    ticket = challenge("register", "cliente", HTTP_USER_AGENT="Dart/3.13")
    datos = {"ticket": ticket["ticket"], "proof": ticket["proof"], "credential": credencial(ticket, clave, aud=IOS)}
    response = APIClient().post(COMPLETE, datos, format="json")
    assert response.status_code == 200
    assert response.data["role"] == "cliente"


def test_correo_existente_pide_contrasena_y_no_cambia_rol(clave, user_marketero):
    ticket = challenge("register", "cliente")
    claims = {"email": user_marketero.email.upper()}
    primero = completar(ticket, clave, claims)
    assert primero.status_code == 409 and primero.data["data"]["link_required"] is True
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject is None
    assert completar(ticket, clave, claims, "incorrecta").status_code == 400
    response = completar(ticket, clave, claims, "Test1234!")
    assert response.status_code == 200 and response.data["role"] == "marketero"
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject == "google-id-123"
    assert user_marketero.nombre == "Marketero Test"
    assert user_marketero.check_password("Test1234!")


def test_login_no_crea_cuentas_sin_registro(clave):
    response = completar(challenge(), clave)
    assert response.status_code == 409 and response.data["data"]["registration_required"] is True
    assert not User.objects.exists()


def test_rol_obligatorio_y_nunca_superadmin():
    for rol in [None, "superadmin", "invalido"]:
        datos = {"purpose": "register"}
        if rol:
            datos["role"] = rol
        assert APIClient().post(CHALLENGE, datos, format="json", **ORIGEN).status_code == 400
    assert not User.objects.exists()


@pytest.mark.parametrize(
    "claims",
    [
        {"aud": "otro-cliente"},
        {"iss": "https://malo.example"},
        {"exp": 1},
        {"email_verified": False},
        {"email_verified": "true"},
        {"email": "invalido"},
        {"nonce": "no-es-el-nonce-del-ticket-12345"},
        {"sub": ""},
        {"iat": 9999999999},
    ],
)
def test_claims_invalidos_se_rechazan(clave, claims):
    assert completar(challenge("register", "cliente"), clave, claims).status_code == 400
    assert not User.objects.exists()


def test_firma_prueba_y_vencimiento(clave):
    ticket = challenge("register", "cliente")
    otra = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert completar(ticket, otra).status_code == 400
    datos = {"ticket": ticket["ticket"], "proof": "x" * 43, "credential": credencial(ticket, clave)}
    assert APIClient().post(COMPLETE, datos, format="json", **ORIGEN).status_code == 400
    GoogleLoginTicket.objects.filter(pk=ticket["ticket"]).update(expira_en=timezone.now() - timedelta(seconds=1))
    vencido = completar(ticket, clave)
    assert vencido.status_code == 400 and vencido.data["data"]["expired"] is True


def test_ticket_de_un_solo_uso(clave):
    ticket = challenge("register", "cliente")
    assert completar(ticket, clave).status_code == 200
    assert completar(ticket, clave).status_code == 400
    otro = challenge()
    datos = {"ticket": otro["ticket"], "proof": otro["proof"], "credential": credencial(ticket, clave)}
    assert APIClient().post(COMPLETE, datos, format="json", **ORIGEN).status_code == 400


def test_origin_ajeno_y_sin_configuracion_fallan_cerrado(settings):
    malo = {"HTTP_ORIGIN": "https://malo.example"}
    assert APIClient().post(CHALLENGE, {"purpose": "login"}, format="json", **malo).status_code == 403
    assert APIClient().post(COMPLETE, {}, format="json", **malo).status_code == 403
    settings.GOOGLE_CLIENT_ID = ""
    assert APIClient().get("/api/auth/google/config/").data["data"]["configured"] is False
    assert APIClient().post(CHALLENGE, {"purpose": "login"}, format="json", **ORIGEN).status_code == 503
    assert APIClient().post(COMPLETE, {}, format="json", **ORIGEN).status_code == 503


def test_suspendida_y_correo_que_google_no_garantiza(clave, user_marketero):
    user_marketero.is_active = False
    user_marketero.save(update_fields=["is_active"])
    suspendida = completar(challenge(), clave, {"email": user_marketero.email})
    assert suspendida.status_code == 403 and suspendida.data["data"]["suspended"] is True
    assert completar(challenge("register", "cliente"), clave, {"email": "nuevo@example.com"}).status_code == 400
    workspace = completar(challenge("register", "cliente"), clave, {"email": "nuevo@example.com", "hd": "example.com"})
    assert workspace.status_code == 200


def test_cuenta_google_crea_contrasena_con_la_recuperacion(clave, django_capture_on_commit_callbacks):
    assert completar(challenge("register", "cliente"), clave).status_code == 200
    user = User.objects.get()
    with django_capture_on_commit_callbacks(execute=True):
        assert APIClient().post("/api/auth/password-reset/", {"email": user.email}, format="json").status_code == 200
    url = re.search(r"http\S+", mail.outbox[-1].body).group()
    token = parse_qs(urlsplit(url).fragment)["token"][0]
    datos = {"token": token, "new_password": "ClaveLocal2026!"}
    assert APIClient().post("/api/auth/password-reset/confirm/", datos, format="json").status_code == 200
    user.refresh_from_db()
    assert user.has_usable_password() and user.google_subject


def test_desvincular_exige_contrasena_y_cierra_sesiones(clave, api_client, user_marketero):
    user_marketero.google_subject = "google-id-123"
    user_marketero.save(update_fields=["google_subject"])
    response = completar(challenge(), clave)
    assert response.status_code == 200
    url = "/api/auth/google/disconnect/"
    assert APIClient().post(url, {}, format="json").status_code == 401
    assert api_client.post(url, {"current_password": "incorrecta"}, format="json").status_code == 400
    assert api_client.post(url, {"current_password": "Test1234!"}, format="json").status_code == 200
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject is None
    refresh = APIClient().post("/api/auth/token/refresh/", {"refresh": response.data["refresh"]}, format="json")
    assert refresh.status_code == 401


def test_desvincular_cuenta_sin_contrasena_pide_crearla(api_client, user_marketero):
    user_marketero.google_subject = "google-id-123"
    user_marketero.set_unusable_password()
    user_marketero.save(update_fields=["google_subject", "password"])
    response = api_client.post("/api/auth/google/disconnect/", {"current_password": "x"}, format="json")
    assert response.status_code == 400 and response.data["data"]["password_required"] is True


def test_intentos_de_vinculacion_limitados_por_cuenta(clave, user_marketero):
    ticket = challenge()
    for _ in range(5):
        assert completar(ticket, clave, {"email": user_marketero.email}, "mala").status_code == 400
    assert completar(ticket, clave, {"email": user_marketero.email}, "Test1234!").status_code == 429
    user_marketero.refresh_from_db()
    assert user_marketero.google_subject is None


def test_falla_de_google_o_de_cache_no_crea_usuarios(clave):
    ticket = challenge("register", "cliente")
    with patch("apps.authentication.google_login.verificar_token_google", side_effect=ConnectionError):
        assert completar(ticket, clave).status_code == 503
    with patch("apps.authentication.google_login.GoogleThrottle.hourly_limit", side_effect=ConnectionError):
        assert completar(ticket, clave).status_code == 503
    assert not User.objects.exists()
