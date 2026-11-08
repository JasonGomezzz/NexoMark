"""Recuperación de contraseña: enlace de un solo uso, sin revelar cuentas."""

import re
import threading
from datetime import timedelta
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication import password_reset
from apps.authentication.models import PasswordResetToken

pytestmark = pytest.mark.django_db
REQUEST = "/api/auth/password-reset/"
CONFIRM = "/api/auth/password-reset/confirm/"
CLOCK = "apps.authentication.recovery_throttles.time.time"


@pytest.fixture(autouse=True)
def envio_sincrono(monkeypatch, settings):
    """En tests el trabajo del hilo corre en línea para poder revisar el correo."""
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    monkeypatch.setattr(password_reset, "_iniciar_hilo", password_reset.procesar_solicitud)


@pytest.fixture
def solicitar(django_capture_on_commit_callbacks):
    def _solicitar(email, ip="127.0.0.1", **headers):
        with django_capture_on_commit_callbacks(execute=True):
            return APIClient().post(REQUEST, {"email": email}, format="json", REMOTE_ADDR=ip, **headers)
    return _solicitar


def _token_del_correo():
    url = re.search(r"http\S+", mail.outbox[-1].body).group()
    return parse_qs(urlsplit(url).fragment)["token"][0]


def _confirmar(token, password="NuevaClave2026!"):
    return APIClient().post(CONFIRM, {"token": token, "new_password": password}, format="json")


class TestSolicitud:
    def test_respuesta_identica_exista_o_no_la_cuenta(self, solicitar, user_marketero):
        conocida = solicitar(user_marketero.email)
        desconocida = solicitar("nadie@example.com")
        assert conocida.status_code == desconocida.status_code == 200
        assert conocida.data == desconocida.data
        assert conocida.data["success"] is True
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user_marketero.email]

    def test_la_peticion_no_consulta_la_bd(self, django_assert_num_queries, user_marketero):
        # Sin consultas en la petición, el tiempo de respuesta no depende de la cuenta:
        # buscarla, crear el token y enviar el correo ocurre después, en otro hilo.
        with patch.object(password_reset.transaction, "on_commit") as on_commit:
            with django_assert_num_queries(0):
                response = APIClient().post(REQUEST, {"email": user_marketero.email}, format="json")
        assert response.status_code == 200
        on_commit.assert_called_once()
        assert len(mail.outbox) == 0

    def test_el_token_se_guarda_hasheado_y_caduca(self, solicitar, user_marketero):
        solicitar(user_marketero.email)
        token = _token_del_correo()
        registro = PasswordResetToken.objects.get(usuario=user_marketero)
        assert registro.token_hash != token
        assert len(registro.token_hash) == 64
        assert token not in mail.outbox[0].body.split("#")[0]  # solo en el fragmento
        duracion = registro.expira_en - registro.fecha_creacion
        assert duracion == timedelta(minutes=30)

    def test_cuenta_inactiva_no_recibe_correo(self, solicitar, user_marketero):
        user_marketero.is_active = False
        user_marketero.save(update_fields=["is_active"])
        assert solicitar(user_marketero.email).status_code == 200
        assert len(mail.outbox) == 0

    def test_correo_mal_formado_400(self, solicitar):
        response = solicitar("no-es-correo")
        assert response.status_code == 400
        assert response.data["success"] is False
        assert "email" in response.data["data"]["errors"]

    def test_un_enlace_nuevo_invalida_el_anterior(self, solicitar, user_marketero):
        with patch(CLOCK, return_value=3600):
            solicitar(user_marketero.email)
        primero = _token_del_correo()
        with patch(CLOCK, return_value=3700):
            solicitar(user_marketero.email)
        segundo = _token_del_correo()
        assert _confirmar(primero).status_code == 400
        assert _confirmar(segundo).status_code == 200

    def test_cooldown_con_mensaje_en_espanol(self, solicitar):
        assert solicitar("nadie@example.com").status_code == 200
        response = solicitar("NADIE@example.com")
        assert response.status_code == 429
        assert response.data["success"] is False
        assert 1 <= response.data["data"]["retry_after"] <= 60
        assert int(response["Retry-After"]) == response.data["data"]["retry_after"]
        assert "Demasiados intentos" in response.data["message"]
        assert solicitar("otro@example.com").status_code == 200


class TestConfirmacion:
    def test_un_solo_uso_y_cierra_todas_las_sesiones(self, solicitar, user_marketero):
        refresh = RefreshToken.for_user(user_marketero)
        refresh["token_version"] = user_marketero.token_version
        access_viejo = str(refresh.access_token)
        version = user_marketero.token_version
        solicitar(user_marketero.email)
        token = _token_del_correo()

        response = _confirmar(token)

        assert response.status_code == 200
        assert response.data["success"] is True
        assert _confirmar(token).status_code == 400
        user_marketero.refresh_from_db()
        assert user_marketero.check_password("NuevaClave2026!")
        assert user_marketero.token_version == version + 1
        assert PasswordResetToken.objects.get(usuario=user_marketero).usado_en is not None
        client = APIClient()
        assert client.post("/api/auth/token/refresh/", {"refresh": str(refresh)}, format="json").status_code == 401
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_viejo}")
        assert client.get("/api/auth/me/").status_code == 401

    def test_enlace_vencido_o_alterado(self, solicitar, user_marketero):
        solicitar(user_marketero.email)
        token = _token_del_correo()
        assert _confirmar(token + "x").status_code == 400
        PasswordResetToken.objects.update(expira_en=timezone.now() - timedelta(seconds=1))
        response = _confirmar(token)
        assert response.status_code == 400
        assert response.data["message"] == password_reset.MENSAJE_ENLACE_INVALIDO
        user_marketero.refresh_from_db()
        assert user_marketero.check_password("Test1234!")

    def test_password_debil_no_consume_el_token(self, solicitar, user_marketero):
        solicitar(user_marketero.email)
        token = _token_del_correo()
        debil = _confirmar(token, "123")
        assert debil.status_code == 400
        assert "new_password" in debil.data["data"]["errors"]
        assert _confirmar(token).status_code == 200

    def test_cuenta_suspendida_despues_de_pedir_el_enlace(self, solicitar, user_marketero):
        solicitar(user_marketero.email)
        token = _token_del_correo()
        user_marketero.is_active = False
        user_marketero.save(update_fields=["is_active"])
        assert _confirmar(token).status_code == 400

    def test_datos_incompletos_400(self):
        response = APIClient().post(CONFIRM, {"token": "abc"}, format="json")
        assert response.status_code == 400
        assert response.data["success"] is False


class TestHilo:
    def test_un_fallo_de_envio_se_registra_y_no_escapa(self):
        conexiones = MagicMock()
        with patch.object(password_reset, "procesar_solicitud", side_effect=OSError("smtp caído")), \
                patch.object(password_reset, "connections", conexiones):
            password_reset._procesar_en_hilo("x@example.com")
        conexiones.close_all.assert_called_once()

    def test_iniciar_hilo_usa_un_hilo_aparte(self, monkeypatch):
        monkeypatch.undo()  # restaura el _iniciar_hilo real
        hecho = threading.Event()
        hilos = []

        def falso(email):
            hilos.append(threading.current_thread())
            hecho.set()

        with patch.object(password_reset, "_procesar_en_hilo", side_effect=falso):
            password_reset._iniciar_hilo("x@example.com")
            assert hecho.wait(2)
        assert hilos[0] is not threading.main_thread()
        assert hilos[0].daemon


class TestCorreoHtml:
    """El correo lleva versión HTML con la identidad NexoMark y el logo adjunto."""

    def test_html_con_el_mismo_enlace_y_logo_inline(self, solicitar, user_marketero):
        solicitar(user_marketero.email)
        correo = mail.outbox[-1]
        html, tipo = correo.alternatives[0]
        assert tipo == "text/html"
        token = _token_del_correo()
        assert f"#token={token}" in html
        assert "Elegir contraseña nueva" in html
        assert user_marketero.email in html
        assert "cid:logo-nexomark" in html
        logos = [a for a in correo.attachments if getattr(a, "get", None) and a.get("Content-ID") == "<logo-nexomark>"]
        assert len(logos) == 1

    def test_escapa_el_nombre(self, solicitar, user_marketero):
        user_marketero.nombre = "<b>Ana</b>"
        user_marketero.save(update_fields=["nombre"])
        solicitar(user_marketero.email)
        html = mail.outbox[-1].alternatives[0][0]
        assert "<b>Ana</b>" not in html
        assert "&lt;b&gt;Ana&lt;/b&gt;" in html

    def test_cuenta_de_google_sin_contrasena_pide_crearla(self, solicitar, user_marketero):
        user_marketero.set_unusable_password()
        user_marketero.google_subject = "google-123"
        user_marketero.save()
        solicitar(user_marketero.email)
        correo = mail.outbox[-1]
        assert correo.subject == "Crea tu contraseña — NexoMark IA"
        assert "Crea tu contraseña de NexoMark" in correo.alternatives[0][0]
