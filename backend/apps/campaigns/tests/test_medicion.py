"""Medición voz vs. formulario: métricas por origen, "sin dato" ≠ 0, CSV sin datos personales."""

import csv
import io
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.campaigns.models import CampaignIntent, IntentEstado, IntentOrigen

pytestmark = pytest.mark.django_db
URL = "/api/intents/medicion/"

CAMPOS_IA = {
    "titulo": "2x1 en capuchinos", "cliente_nombre": "Café Aurora", "cliente_email": "cliente@test.com",
    "industria": "gastronomia", "tono": "casual", "plataforma": "instagram", "prompt": "Promo 2x1",
}


def intent(usuario, origen, estado=IntentEstado.CONFIRMADO, captura_ms=None, revision_s=None, finales=None,
           propuestos=None, texto="Súbeme una foto con dos por uno en capuchinos"):
    i = CampaignIntent.objects.create(
        usuario=usuario, origen=origen, transcripcion=texto,
        campos_interpretados=propuestos or dict(CAMPOS_IA), campos_finales=finales or dict(CAMPOS_IA),
        estado=estado, interpretacion_ms=800, captura_ms=captura_ms,
    )
    if revision_s is not None:
        CampaignIntent.objects.filter(pk=i.pk).update(confirmado_at=i.fecha_creacion + timedelta(seconds=revision_s))
        i.refresh_from_db()
    return i


def test_compara_voz_y_formulario(api_client, user_marketero):
    intent(user_marketero, IntentOrigen.VOZ, captura_ms=12_000, revision_s=30,
           finales={**CAMPOS_IA, "tono": "urgente"})
    intent(user_marketero, IntentOrigen.VOZ, captura_ms=18_000, revision_s=50)
    intent(user_marketero, IntentOrigen.VOZ, estado=IntentEstado.DESCARTADO)
    intent(user_marketero, IntentOrigen.FORMULARIO, captura_ms=60_000, revision_s=40,
           propuestos={**CAMPOS_IA, "industria": None}, finales=dict(CAMPOS_IA))

    datos = api_client.get(URL).data["data"]
    voz, form = datos["voz"], datos["formulario"]
    assert (voz["intenciones"], voz["confirmadas"], voz["descartadas"]) == (3, 2, 1)
    assert voz["tasa_finalizacion"] == pytest.approx(0.667, abs=0.001)
    assert voz["captura_mediana_s"] == 15.0
    assert voz["revision_mediana_s"] == 40.0
    assert voz["total_mediana_s"] == 55.0
    assert voz["campos_corregidos_promedio"] == 0.5
    assert voz["correcciones_por_campo"]["tono"] == 1
    assert form["tasa_finalizacion"] == 1.0
    assert form["correcciones_por_campo"]["industria"] == 1  # la IA no lo encontró y la persona lo llenó
    assert form["campos_vacios_ia_promedio"] == 1.0


def test_sin_datos_es_none_no_cero(api_client, user_marketero):
    intent(user_marketero, IntentOrigen.VOZ, estado=IntentEstado.BORRADOR)  # sin captura ni confirmar
    datos = api_client.get(URL).data["data"]
    assert datos["voz"]["captura_mediana_s"] is None
    assert datos["voz"]["revision_mediana_s"] is None
    assert datos["voz"]["correcciones_por_campo"] is None
    assert datos["formulario"]["intenciones"] == 0
    assert datos["formulario"]["tasa_finalizacion"] is None


def test_marketero_ve_solo_lo_suyo_y_superadmin_todo(api_client, user_marketero, superadmin_client):
    otro = User.objects.create_user(email="otro@test.com", password="Test1234!", nombre="Otro", rol=UserRole.MARKETERO)
    intent(user_marketero, IntentOrigen.VOZ)
    intent(otro, IntentOrigen.VOZ)
    assert api_client.get(URL).data["data"]["voz"]["intenciones"] == 1
    assert superadmin_client.get(URL).data["data"]["voz"]["intenciones"] == 2


def test_cliente_no_accede(cliente):
    c = APIClient()
    c.force_authenticate(user=cliente)
    assert c.get(URL).status_code == 403


def test_filtro_por_fechas(api_client, user_marketero):
    viejo = intent(user_marketero, IntentOrigen.VOZ)
    CampaignIntent.objects.filter(pk=viejo.pk).update(fecha_creacion=timezone.now() - timedelta(days=40))
    intent(user_marketero, IntentOrigen.VOZ)
    desde = (timezone.now() - timedelta(days=7)).date().isoformat()
    assert api_client.get(URL, {"desde": desde}).data["data"]["voz"]["intenciones"] == 1
    assert api_client.get(URL, {"desde": "ayer"}).status_code == 400


def test_csv_sin_texto_ni_correo(api_client, user_marketero):
    intent(user_marketero, IntentOrigen.VOZ, captura_ms=9000, revision_s=20, finales={**CAMPOS_IA, "titulo": "Otro"},
           texto="Texto secreto del brief con datos")
    response = api_client.get(URL, {"formato": "csv"})
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    contenido = response.content.decode()
    assert "secreto" not in contenido and "@" not in contenido
    filas = list(csv.DictReader(io.StringIO(contenido)))
    assert filas[0]["origen"] == "voz"
    assert filas[0]["captura_ms"] == "9000"
    assert filas[0]["revision_ms"] == "20000"
    assert filas[0]["lista_corregidos"] == "titulo"


def test_interpret_guarda_la_captura(api_client):
    datos = {"texto": "Campaña casual para Café Aurora en Instagram", "origen": "voz", "captura_ms": 14_500}
    response = api_client.post("/api/intents/interpret/", datos, format="json")
    assert response.status_code == 201
    assert CampaignIntent.objects.get().captura_ms == 14_500
    fuera = {**datos, "captura_ms": 10_000_000}
    assert api_client.post("/api/intents/interpret/", fuera, format="json").status_code == 400
