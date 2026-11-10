"""
Cambio de contraseña seguro: cierra todas las sesiones, limita los intentos y avisa por correo.

Adaptado de las pruebas de la rama de Piero (70b3f60d, `test_password_security.py`) al
modelo de `remejora` (el cambio de correo pendiente cuelga de `usuario`, no de `owner`).
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.core import mail
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import EmailChangeRequest, User
from apps.authentication.serializers import ChangePasswordSerializer

pytestmark = pytest.mark.django_db

URL = "/api/auth/me/change-password/"
PAYLOAD = {"current_password": "Test1234!", "new_password": "NuevaClave2026!"}


def test_el_cambio_cierra_todas_las_sesiones_y_avisa_por_correo(api_client, user_marketero):
    sesiones = []
    for _ in range(2):
        refresh = RefreshToken.for_user(user_marketero)
        refresh["token_version"] = user_marketero.token_version
        sesiones.append((str(refresh), str(refresh.access_token)))

    response = api_client.post(URL, PAYLOAD, format="json")

    assert response.status_code == 200
    assert response.data["data"]["reauthentication_required"] is True
    assert response.data["data"]["notification_sent"] is True
    assert response["Cache-Control"] == "no-store"
    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 1
    assert user_marketero.check_password(PAYLOAD["new_password"])
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [user_marketero.email]
    assert PAYLOAD["current_password"] not in mail.outbox[0].body
    assert PAYLOAD["new_password"] not in mail.outbox[0].body
    for refresh, access in sesiones:
        publico = APIClient()
        assert publico.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json").status_code == 401
        publico.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        assert publico.get("/api/auth/me/").status_code == 401
    entrada = APIClient().post(
        "/api/auth/token/",
        {"email": user_marketero.email, "password": PAYLOAD["new_password"]},
        format="json",
    )
    assert entrada.status_code == 200


def test_una_validacion_fallida_no_cambia_nada_ni_avisa(api_client, user_marketero):
    casos = [
        ("incorrecta", "NuevaClave2026!"),  # actual mal escrita
        ("Test1234!", "Test1234!"),  # igual a la actual
        ("Test1234!", "x"),  # demasiado corta
        ("Test1234!", "x" * 129),  # pasa del máximo
    ]
    for actual, nueva in casos:
        response = api_client.post(URL, {"current_password": actual, "new_password": nueva}, format="json")
        assert response.status_code == 400
    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 0
    assert user_marketero.check_password("Test1234!")
    assert not mail.outbox


def test_se_revalida_con_la_fila_bloqueada_si_la_sesion_cambio_despues_de_validar(user_marketero):
    serializer = ChangePasswordSerializer(data=PAYLOAD, context={"request": SimpleNamespace(user=user_marketero)})
    assert serializer.is_valid()
    User.objects.filter(pk=user_marketero.pk).update(token_version=1)  # otra sesión ya cambió la contraseña
    with pytest.raises(AuthenticationFailed):
        serializer.save()
    user_marketero.refresh_from_db()
    assert user_marketero.check_password("Test1234!")


def test_los_espacios_de_la_contrasena_se_conservan(api_client, user_marketero):
    actual = "  ClaveActual7!  "
    nueva = "  ClaveNueva8!  "
    user_marketero.set_password(actual)
    user_marketero.save(update_fields=["password"])
    response = api_client.post(URL, {"current_password": actual, "new_password": nueva}, format="json")
    assert response.status_code == 200
    user_marketero.refresh_from_db()
    assert user_marketero.check_password(nueva)
    assert not user_marketero.check_password(nueva.strip())


@pytest.mark.parametrize("resultado_correo", [0, RuntimeError("smtp no disponible")])
def test_si_falla_el_correo_la_contrasena_igual_cambia(api_client, user_marketero, resultado_correo):
    if isinstance(resultado_correo, Exception):
        parche = patch("apps.authentication.password_security.send_mail", side_effect=resultado_correo)
    else:
        parche = patch("apps.authentication.password_security.send_mail", return_value=resultado_correo)
    with parche:
        response = api_client.post(URL, PAYLOAD, format="json")
    assert response.status_code == 200
    assert response.data["data"]["notification_sent"] is False
    assert "la contraseña sí se cambió" in response.data["message"]
    user_marketero.refresh_from_db()
    assert user_marketero.token_version == 1
    assert user_marketero.check_password(PAYLOAD["new_password"])


def test_el_limite_por_cuenta_no_se_esquiva_cambiando_de_ip_y_falla_cerrado(api_client, user_marketero):
    for i in range(5):
        response = api_client.post(
            URL, {**PAYLOAD, "current_password": "incorrecta"}, format="json", REMOTE_ADDR=f"10.0.0.{i + 1}"
        )
        assert response.status_code == 400
    bloqueado = api_client.post(URL, PAYLOAD, format="json", REMOTE_ADDR="10.0.0.99")
    assert bloqueado.status_code == 429
    assert bloqueado.data["data"]["retry_after"] > 0
    assert "Demasiados intentos" in bloqueado.data["message"]
    assert bloqueado["Retry-After"]
    with patch(
        "apps.authentication.password_security.PasswordChangeThrottle.hourly_limit", side_effect=ConnectionError
    ):
        assert api_client.post(URL, PAYLOAD, format="json").status_code == 503
    user_marketero.refresh_from_db()
    assert user_marketero.check_password("Test1234!")
    assert not mail.outbox


def test_el_limite_por_ip_corta_a_quien_prueba_con_cuentas_distintas(api_client, user_marketero, settings):
    settings.PASSWORD_CHANGE_IP_HOURLY_LIMIT = 2
    for _ in range(2):
        assert api_client.post(URL, {**PAYLOAD, "current_password": "incorrecta"}, format="json").status_code == 400
    assert api_client.post(URL, PAYLOAD, format="json").status_code == 429


def test_el_cambio_cancela_un_cambio_de_correo_pendiente(api_client, user_marketero):
    pedido = api_client.post(
        "/api/auth/me/change-email/",
        {"new_email": "nuevo@example.com", "current_password": "Test1234!"},
        format="json",
    )
    assert pedido.status_code == 202
    assert EmailChangeRequest.objects.filter(usuario=user_marketero).exists()
    assert api_client.post(URL, PAYLOAD, format="json").status_code == 200
    assert not EmailChangeRequest.objects.filter(usuario=user_marketero).exists()
