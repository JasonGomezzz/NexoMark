"""Cambio de correo: dos confirmaciones, un solo uso y cierre de sesiones."""

import re
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import EmailChangeRequest, User

pytestmark = pytest.mark.django_db
REQUEST = "/api/auth/me/change-email/"
CONFIRM = "/api/auth/email-change/confirm/"


@pytest.fixture(autouse=True)
def correo_local(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


def iniciar(api_client, destino="nuevo@example.com"):
    response = api_client.post(REQUEST, {"new_email": destino, "current_password": "Test1234!"}, format="json")
    assert response.status_code == 202, response.data
    enlaces = []
    for mensaje in mail.outbox[-2:]:
        url = re.search(r"http\S+", mensaje.body).group()
        assert urlsplit(url).path == "/confirm-email-change"
        enlaces.append({k: v[0] for k, v in parse_qs(urlsplit(url).fragment).items()})
    return enlaces


@pytest.mark.parametrize("orden", [(0, 1), (1, 0)])
def test_dos_correos_un_solo_uso_y_cierra_sesiones(api_client, user_marketero, orden):
    original = user_marketero.email
    refresh = RefreshToken.for_user(user_marketero)
    refresh["token_version"] = user_marketero.token_version
    access = str(refresh.access_token)

    enlaces = iniciar(api_client)
    pendiente = EmailChangeRequest.objects.get(usuario=user_marketero)
    assert enlaces[0]["token"] not in pendiente.hash_token_actual
    assert mail.outbox[-2].to == [original]
    assert mail.outbox[-1].to == ["nuevo@example.com"]

    publico = APIClient()
    assert publico.get(CONFIRM, enlaces[0]).status_code == 405  # abrir o prefetch no confirma
    primero = publico.post(CONFIRM, enlaces[orden[0]], format="json")
    assert primero.status_code == 200 and primero.data["data"]["completed"] is False
    user_marketero.refresh_from_db()
    assert user_marketero.email == original
    assert publico.post(CONFIRM, enlaces[orden[0]], format="json").status_code == 400

    segundo = publico.post(CONFIRM, enlaces[orden[1]], format="json")
    assert segundo.status_code == 200 and segundo.data["data"]["completed"] is True
    user_marketero.refresh_from_db()
    assert user_marketero.email == "nuevo@example.com"
    assert not EmailChangeRequest.objects.exists()
    assert publico.post(CONFIRM, enlaces[orden[1]], format="json").status_code == 400

    assert publico.post("/api/auth/token/refresh/", {"refresh": str(refresh)}, format="json").status_code == 401
    publico.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    assert publico.get("/api/auth/me/").status_code == 401
    login = {"email": "nuevo@example.com", "password": "Test1234!"}
    assert APIClient().post("/api/auth/token/", login, format="json").status_code == 200
    viejo = {"email": original, "password": "Test1234!"}
    assert APIClient().post("/api/auth/token/", viejo, format="json").status_code == 401


def test_exige_sesion_contrasena_y_correo_disponible(api_client, user_marketero, cliente):
    assert APIClient().post(REQUEST, {}, format="json").status_code == 401
    assert APIClient().get(REQUEST).status_code == 401
    assert APIClient().delete(REQUEST).status_code == 401
    casos = [
        ("malo", "Test1234!"),
        ("nuevo@example.com", "incorrecta"),
        (user_marketero.email.upper(), "Test1234!"),
        (cliente.email.upper(), "Test1234!"),
    ]
    for destino, password in casos:
        response = api_client.post(REQUEST, {"new_email": destino, "current_password": password}, format="json")
        assert response.status_code == 400
        assert response.data["success"] is False
    assert not EmailChangeRequest.objects.exists()
    assert not mail.outbox


def test_cuenta_solo_google_debe_crear_contrasena(api_client, user_marketero):
    user_marketero.set_unusable_password()
    user_marketero.save(update_fields=["password"])
    response = api_client.post(REQUEST, {"new_email": "nuevo@example.com", "current_password": "x"}, format="json")
    assert response.status_code == 400
    assert response.data["data"]["password_required"] is True
    assert not mail.outbox


@pytest.mark.parametrize("cambio", ["vencida", "password", "version", "correo", "inactiva"])
def test_se_invalida_tras_cambios_de_seguridad(api_client, user_marketero, cambio):
    enlaces = iniciar(api_client)
    if cambio == "vencida":
        EmailChangeRequest.objects.update(expira_en=timezone.now() - timedelta(seconds=1))
    else:
        updates = {
            "password": {"password": "cambiada"},
            "version": {"token_version": 1},
            "correo": {"email": "otro@example.com"},
            "inactiva": {"is_active": False},
        }
        User.objects.filter(pk=user_marketero.pk).update(**updates[cambio])
    assert APIClient().post(CONFIRM, enlaces[0], format="json").status_code == 400


def test_cancelar_reemplazar_manipular_y_estado(api_client):
    enlaces = iniciar(api_client)
    pendiente = api_client.get(REQUEST).data["data"]["pending"]
    assert pendiente["new_email"] == "nuevo@example.com"
    assert pendiente["old_confirmed"] is False and pendiente["new_confirmed"] is False

    assert APIClient().post(CONFIRM, {**enlaces[0], "side": "new"}, format="json").status_code == 400
    assert APIClient().post(CONFIRM, {**enlaces[0], "token": "x" * 43}, format="json").status_code == 400

    assert api_client.delete(REQUEST).status_code == 200
    assert api_client.get(REQUEST).data["data"]["pending"] is None
    assert APIClient().post(CONFIRM, enlaces[0], format="json").status_code == 400

    enlaces = iniciar(api_client)
    iniciar(api_client)
    assert APIClient().post(CONFIRM, enlaces[0], format="json").status_code == 400
    assert EmailChangeRequest.objects.count() == 1


def test_estado_muestra_la_confirmacion_parcial(api_client):
    enlaces = iniciar(api_client)
    APIClient().post(CONFIRM, enlaces[0], format="json")
    pendiente = api_client.get(REQUEST).data["data"]["pending"]
    assert pendiente["old_confirmed"] is True and pendiente["new_confirmed"] is False


def test_falla_smtp_revierte_aunque_un_correo_haya_salido(api_client):
    iniciar(api_client)
    original = EmailChangeRequest.objects.get().pk
    with patch("apps.authentication.email_change.send_mail", side_effect=[1, RuntimeError("smtp")]):
        response = api_client.post(
            REQUEST, {"new_email": "otro@example.com", "current_password": "Test1234!"}, format="json"
        )
    assert response.status_code == 503
    assert EmailChangeRequest.objects.get().pk == original


def test_destino_ocupado_al_completar_no_cambia_la_cuenta(api_client, user_marketero):
    original = user_marketero.email
    enlaces = iniciar(api_client)
    User.objects.create_user("NUEVO@example.com", "OtraClave2026!", "Otra persona")
    publico = APIClient()
    assert publico.post(CONFIRM, enlaces[0], format="json").status_code == 200
    assert publico.post(CONFIRM, enlaces[1], format="json").status_code == 409
    user_marketero.refresh_from_db()
    assert user_marketero.email == original


def test_limites_y_falla_de_cache(api_client):
    for _ in range(5):
        api_client.post(REQUEST, {"new_email": "nuevo@example.com", "current_password": "mala"}, format="json")
    assert api_client.post(REQUEST, {}, format="json").status_code == 429
    publico = APIClient()
    for _ in range(30):
        assert publico.post(CONFIRM, {}, format="json").status_code == 400
    assert publico.post(CONFIRM, {}, format="json").status_code == 429
    with patch(
        "apps.authentication.email_change.EmailChangeThrottle.hourly_limit", side_effect=ConnectionError
    ), patch("apps.authentication.email_change.send_mail") as envio:
        assert api_client.post(REQUEST, {}, format="json").status_code == 503
        envio.assert_not_called()


def test_otra_cuenta_no_ve_ni_cancela_la_solicitud(api_client, user_marketero, cliente):
    iniciar(api_client)
    otro = APIClient()
    otro.force_authenticate(user=cliente)
    assert otro.get(REQUEST).data["data"]["pending"] is None
    assert otro.delete(REQUEST).status_code == 200
    assert EmailChangeRequest.objects.filter(usuario=user_marketero).exists()
