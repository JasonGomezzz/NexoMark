"""Lista liviana y miniaturas para la app móvil."""

import base64
from io import BytesIO

import pytest
from PIL import Image
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def png_b64(size=(1024, 1024)) -> str:
    salida = BytesIO()
    Image.new("RGB", size, "teal").save(salida, format="PNG")
    return base64.b64encode(salida.getvalue()).decode()


def test_vista_ligera_no_trae_base64(api_client, campaign):
    campaign.imagen_b64 = png_b64()
    campaign.save(update_fields=["imagen_b64"])
    completa = api_client.get("/api/campaigns/").data["results"][0]
    ligera = api_client.get("/api/campaigns/", {"vista": "ligera"}).data["results"][0]
    assert "imagen_b64" in completa
    assert "imagen_b64" not in ligera
    assert ligera["tiene_imagen"] is True
    assert ligera["titulo"] == completa["titulo"]


def test_miniatura_jpeg_reducida(api_client, campaign):
    campaign.imagen_b64 = png_b64()
    campaign.save(update_fields=["imagen_b64"])
    response = api_client.get(f"/api/campaigns/{campaign.pk}/miniatura/")
    assert response.status_code == 200
    assert response["Content-Type"] == "image/jpeg"
    with Image.open(BytesIO(response.content)) as imagen:
        assert max(imagen.size) == 480
    # La segunda vez sale de la caché con el mismo contenido.
    assert api_client.get(f"/api/campaigns/{campaign.pk}/miniatura/").content == response.content


def test_miniatura_sin_imagen_o_ilegible(api_client, campaign):
    assert api_client.get(f"/api/campaigns/{campaign.pk}/miniatura/").status_code == 204
    campaign.imagen_b64 = "no-es-base64-de-una-imagen"
    campaign.save(update_fields=["imagen_b64"])
    assert api_client.get(f"/api/campaigns/{campaign.pk}/miniatura/").status_code == 204


def test_miniatura_solo_para_quien_ve_la_campana(campaign, cliente):
    otro = APIClient()
    otro.force_authenticate(user=cliente)
    assert otro.get(f"/api/campaigns/{campaign.pk}/miniatura/").status_code == 404
    assert APIClient().get(f"/api/campaigns/{campaign.pk}/miniatura/").status_code == 401
