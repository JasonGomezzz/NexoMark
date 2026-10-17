"""Selector de año y series mensuales del dashboard de estadísticas."""

from datetime import datetime

import pytest
from django.utils import timezone

from apps.social.models import PublicacionEstado, PublicationMetric, RedSocial
from apps.social.tests.datos import cliente_api, conexion, publicacion

pytestmark = pytest.mark.django_db


def _fecha(anio: int, mes: int, dia: int = 10) -> datetime:
    return timezone.make_aware(datetime(anio, mes, dia, 12, 0))


@pytest.fixture
def publicadas(campana, cliente):
    """Dos de Instagram en marzo de 2025 (una sin dato de me gusta) y una de Facebook en 2026."""
    ig1 = publicacion(campana, conexion(cliente, cuenta_id="ig-1"), estado=PublicacionEstado.PUBLICADO,
                      externo_id="m-1", publicado_at=_fecha(2025, 3))
    ig2 = publicacion(campana, conexion(cliente, cuenta_id="ig-2"), estado=PublicacionEstado.PUBLICADO,
                      externo_id="m-2", publicado_at=_fecha(2025, 3, 20))
    fb = publicacion(campana, conexion(cliente, red=RedSocial.FACEBOOK, cuenta_id="page-1"),
                     estado=PublicacionEstado.PUBLICADO, externo_id="p-1", publicado_at=_fecha(2026, 2))
    PublicationMetric.objects.create(publicacion=ig1, me_gusta=8)
    PublicationMetric.objects.create(publicacion=ig2, me_gusta=None)
    PublicationMetric.objects.create(publicacion=fb, me_gusta=0)
    return ig1, ig2, fb


def _resumen(usuario, **params):
    return cliente_api(usuario).get("/api/social/publications/summary/", params).data["data"]


def test_con_anio_los_totales_son_solo_de_ese_anio(publicadas, user_marketero):
    data = _resumen(user_marketero, anio=2025)
    assert data["total_publicaciones"] == 2
    assert data["redes"]["instagram"]["publicaciones"] == 2
    assert data["redes"]["instagram"]["me_gusta"] == 8
    assert data["redes"]["facebook"]["publicaciones"] == 0


def test_sin_anio_se_mantiene_todo_el_historial(publicadas, user_marketero):
    data = _resumen(user_marketero)
    assert data["total_publicaciones"] == 3
    assert data["anual"]["anio"] == timezone.localtime().year


def test_serie_anual_tiene_los_doce_meses_con_ceros_reales(publicadas, user_marketero):
    anual = _resumen(user_marketero, anio=2025)["anual"]
    meses = anual["publicaciones_por_mes"]
    assert [m["mes"] for m in meses] == [f"2025-{m:02d}" for m in range(1, 13)]
    assert meses[2]["instagram"] == 2
    assert sum(m["instagram"] for m in meses) == 2
    assert all(m["facebook"] == 0 for m in meses)


def test_me_gusta_por_mes_distingue_sin_dato_de_cero(publicadas, user_marketero):
    me_gusta_2025 = _resumen(user_marketero, anio=2025)["anual"]["me_gusta_por_mes"]
    marzo = me_gusta_2025[2]
    assert (marzo["instagram"], marzo["instagram_con_dato"], marzo["instagram_publicaciones"]) == (8, 1, 2)
    assert me_gusta_2025[0]["instagram"] is None

    febrero_2026 = _resumen(user_marketero, anio=2026)["anual"]["me_gusta_por_mes"][1]
    assert (febrero_2026["facebook"], febrero_2026["facebook_con_dato"]) == (0, 1)


def test_anios_disponibles_incluye_el_actual_y_los_que_tienen_publicaciones(publicadas, user_marketero):
    anios = _resumen(user_marketero, anio=2025)["anual"]["anios"]
    actual = timezone.localtime().year
    assert anios == sorted({2025, 2026, actual}, reverse=True)


def test_pendientes_sin_fecha_de_publicacion_cuentan_en_el_anio_de_creacion(campana, cliente, user_marketero):
    publicacion(campana, conexion(cliente, cuenta_id="ig-9"))
    actual = timezone.localtime().year
    assert _resumen(user_marketero, anio=actual)["pendientes"] == 1
    assert _resumen(user_marketero, anio=actual - 1)["pendientes"] == 0


def test_historial_filtra_por_anio(publicadas, user_marketero):
    api = cliente_api(user_marketero)
    lista = api.get("/api/social/publications/", {"anio": 2025}).data["data"]["publicaciones"]
    assert {p["id"] for p in lista} == {p.id for p in publicadas[:2]}


@pytest.mark.parametrize("anio", ["dos mil", "1999", "2101"])
def test_anio_invalido_responde_400(anio, user_marketero):
    api = cliente_api(user_marketero)
    assert api.get("/api/social/publications/summary/", {"anio": anio}).status_code == 400
    assert api.get("/api/social/publications/", {"anio": anio}).status_code == 400


def test_el_cliente_solo_ve_su_anio(publicadas, db):
    from apps.authentication.models import User, UserRole

    ajeno = User.objects.create_user(email="ajeno@test.com", password="Test1234!", nombre="Ajeno",
                                     rol=UserRole.CLIENTE)
    anual = _resumen(ajeno, anio=2025)["anual"]
    assert sum(m["instagram"] for m in anual["publicaciones_por_mes"]) == 0
