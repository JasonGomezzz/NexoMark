"""Retorno OAuth a la app móvil: el callback vuelve por nexomark:// y el canje sigue exigiendo el JWT."""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.social.models import OAuthAutorizacion, PlataformaOAuth
from services import meta_graph

PAGINAS = [{
    "id": "page-1", "name": "Café Aurora", "access_token": "EAAG-pagina",
    "instagram_business_account": {"id": "ig-1", "username": "cafe.aurora"},
}]

pytestmark = pytest.mark.django_db


def cliente_api(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def state_de(url: str) -> str:
    return parse_qs(urlparse(url).query)["state"][0]


def fragmento(response) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(response["Location"]).fragment).items()}


def test_meta_desde_la_app_vuelve_por_el_esquema(cliente):
    url = cliente_api(cliente).get("/api/social/meta/connect/", {"plataforma": "app"}).data["data"]["url"]
    state = state_de(url)
    assert OAuthAutorizacion.objects.get().plataforma == PlataformaOAuth.APP

    response = APIClient().get("/api/social/meta/callback/", {"code": "abc", "state": state})
    assert response.status_code == 302
    destino = urlparse(response["Location"])
    assert (destino.scheme, destino.netloc, destino.path) == ("nexomark", "oauth", "/meta")
    assert destino.query == ""
    assert fragmento(response) == {"code": "abc", "state": state}
    assert response["Cache-Control"] == "no-store"


def test_meta_web_sigue_volviendo_a_la_pagina(cliente):
    state = state_de(cliente_api(cliente).get("/api/social/meta/connect/").data["data"]["url"])
    response = APIClient().get("/api/social/meta/callback/", {"code": "abc", "state": state})
    assert response["Location"].startswith("http://frontend.test/redes/meta-retorno#")


def test_cancelar_en_meta_tambien_vuelve_a_la_app(cliente):
    state = state_de(cliente_api(cliente).get("/api/social/meta/connect/", {"plataforma": "app"}).data["data"]["url"])
    response = APIClient().get("/api/social/meta/callback/", {"error": "access_denied", "state": state})
    assert response["Location"] == "nexomark://oauth/meta#error=cancelado"


def test_otra_app_con_el_esquema_no_puede_canjear(cliente):
    """Quien intercepte nexomark:// recibe code y state, pero sin el JWT de la víctima no los canjea."""
    state = state_de(cliente_api(cliente).get("/api/social/meta/connect/", {"plataforma": "app"}).data["data"]["url"])
    atacante = User.objects.create_user(
        email="atacante@test.com", password="Test1234!", nombre="Atacante", rol=UserRole.CLIENTE
    )
    with patch.object(meta_graph, "canjear_codigo") as canjear:
        response = cliente_api(atacante).post("/api/social/meta/complete/", {"code": "abc", "state": state})
    assert response.status_code == 403
    canjear.assert_not_called()

    with patch.object(meta_graph, "canjear_codigo", return_value="token"), \
            patch.object(meta_graph, "paginas_con_instagram", return_value=PAGINAS):
        propio = cliente_api(cliente).post("/api/social/meta/complete/", {"code": "abc", "state": state})
    assert propio.status_code == 200


def test_x_desde_la_app_vuelve_por_el_esquema(cliente, settings):
    settings.X_HABILITADO = True
    url = cliente_api(cliente).get("/api/social/x/connect/", {"plataforma": "app"}).data["data"]["url"]
    state = state_de(url)
    response = APIClient().get("/api/social/x/callback/", {"code": "abc", "state": state})
    destino = urlparse(response["Location"])
    assert (destino.scheme, destino.netloc, destino.path) == ("nexomark", "oauth", "/x")
    assert fragmento(response) == {"code": "abc", "state": state}


def test_plataforma_desconocida_se_trata_como_web(cliente):
    cliente_api(cliente).get("/api/social/meta/connect/", {"plataforma": "javascript"})
    assert OAuthAutorizacion.objects.get().plataforma == PlataformaOAuth.WEB
