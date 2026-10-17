"""
Versión para X: el cliente aprueba la variante y se publica exactamente lo aprobado.

Regla de oro (decisión del 16/10): X opcional y apagada por defecto, confirmación
del costo, tope de gasto, hash del texto aprobado al publicar, editar la variante
solo la devuelve a borrador y nunca se reabre una campaña aprobada.

La API de X se simula con httpx.request (nunca se llama a X de verdad) y la IA
corre en modo simulado (USE_MOCK_AI=True en los settings de test).
"""

import base64
import json
from datetime import timedelta
from unittest.mock import patch

import httpx
import pytest
from django.utils import timezone

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignStatus
from apps.social.models import (
    ConexionEstado,
    GastoMensualX,
    PublicacionEstado,
    Publication,
    RedSocial,
    SocialConnection,
    VarianteX,
    VarianteXEstado,
)
from services import gemini_text_service, x_api, x_texto
from services.metrics_service import MetricasNoDisponibles, refrescar_metricas, resumen_por_red
from services.publication_service import publicar_campana_aprobada
from services.social_tokens import cifrar, descifrar

from .datos import cliente_api, conexion, publicacion

VARIANTES = "/api/social/x-variants/"
MEDIA_ID = "710511363345354753"
POST_ID = "1445880548472328192"
COPY_LARGO = ("¡Este fin de semana 2x1 en todos los capuchinos de Café Aurora! " * 6).strip()


def url_variante(variante, accion: str = "") -> str:
    return f"{VARIANTES}{variante.id}/{accion + '/' if accion else ''}"


class HttpXFalso:
    """Reemplaza httpx.request en services.x_api. `fallos` cambia la respuesta de una ruta."""

    def __init__(self, **fallos):
        self.llamadas: list[dict] = []
        self.fallos = fallos

    def __call__(self, metodo, url, **kwargs):
        ruta = url.removeprefix("https://api.x.com")
        self.llamadas.append({"metodo": metodo, "ruta": ruta, **kwargs})
        fallo = self.fallos.get(ruta)
        if isinstance(fallo, Exception):
            raise fallo
        if isinstance(fallo, httpx.Response):
            return fallo
        if ruta == "/2/media/upload":
            return httpx.Response(200, json={"data": {"id": MEDIA_ID, "media_key": "3_1", "expires_after_secs": 86400}})
        if ruta == "/2/tweets":
            return httpx.Response(201, json={"data": {"id": POST_ID, "text": kwargs["json"]["text"]}})
        if ruta == "/2/oauth2/token":
            return httpx.Response(200, json={"access_token": "nuevo-access", "refresh_token": "nuevo-refresh",
                                             "expires_in": 7200, "token_type": "bearer"})
        raise AssertionError(f"Llamada inesperada a X: {metodo} {ruta}")

    def rutas(self) -> list[str]:
        return [c["ruta"] for c in self.llamadas]


@pytest.fixture
def x_on(settings):
    settings.X_HABILITADO = True
    return settings


@pytest.fixture
def cuenta_x(user_marketero) -> SocialConnection:
    con = conexion(user_marketero, red=RedSocial.X, cuenta_id="999", cuenta_nombre="@agencia", pagina_id="")
    con.refresh_token_cifrado = cifrar("refresh-vigente")
    con.token_expira_at = timezone.now() + timedelta(hours=1)
    con.save()
    return con


@pytest.fixture
def otro_marketero(db) -> User:
    return User.objects.create_user(email="otro@test.com", password="Test1234!", nombre="Otro", rol=UserRole.MARKETERO)


@pytest.fixture
def otro_cliente(db) -> User:
    return User.objects.create_user(email="ajeno@test.com", password="Test1234!", nombre="Ajeno", rol=UserRole.CLIENTE)


def crear(user, campana, **datos):
    return cliente_api(user).post(VARIANTES, {"campaign": campana.id, **datos}, format="json")


def aprobada(user_marketero, cliente, campana, texto="2x1 en capuchinos este sábado ☕ #CaféAurora") -> VarianteX:
    """Recorre el flujo real por la API: crear → enviar → el cliente aprueba."""
    assert crear(user_marketero, campana, texto=texto).status_code == 201
    variante = VarianteX.objects.get(campaign=campana)
    assert cliente_api(user_marketero).post(url_variante(variante, "enviar")).status_code == 200
    variante.refresh_from_db()
    hash_visto = x_texto.hash_texto(variante.texto)
    assert cliente_api(cliente).post(url_variante(variante, "aprobar"), {"hash_texto": hash_visto},
                                     format="json").status_code == 200
    variante.refresh_from_db()
    return variante


def publicar(user, variante, cuenta, falso=None, **extra):
    falso = falso or HttpXFalso()
    datos = {"conexion": cuenta.id, "confirmo_costo": True, **extra}
    with patch.object(x_api.httpx, "request", falso):
        response = cliente_api(user).post(url_variante(variante, "publicar"), datos, format="json")
    return response, falso


@pytest.mark.django_db
class TestInterruptor:
    def test_con_x_apagada_las_variantes_responden_403(self, api_client, campana):
        assert api_client.get(VARIANTES).status_code == 403
        response = api_client.post(VARIANTES, {"campaign": campana.id}, format="json")
        assert response.status_code == 403
        assert response.data["message"] == "X está desactivado en este servidor."
        assert not VarianteX.objects.exists()


@pytest.mark.django_db
class TestCrearVariante:
    def test_resume_la_campana_aprobada_sin_cobrar_ni_llamar_a_gemini(self, x_on, user_marketero, campana):
        Campaign.objects.filter(pk=campana.pk).update(texto_generado=COPY_LARGO + " https://cafe.pe/promo")
        campana.refresh_from_db()
        creditos, version = user_marketero.tokens_disponibles, campana.version
        with patch.object(gemini_text_service.httpx, "post", side_effect=AssertionError("no debe llamar")):
            response = crear(user_marketero, campana)
        assert response.status_code == 201, response.data
        data = response.data["data"]["variante"]
        assert data["estado"] == "borrador" and data["generada_por_ia"] is False
        assert data["longitud"] <= 280 and "http" not in data["texto"]
        assert data["texto"] == x_texto.resumen_basico(campana.texto_generado)
        assert data["vigente"] is True and data["bloqueada"] is False
        assert "sin IA" in response.data["message"]

        user_marketero.refresh_from_db()
        campana.refresh_from_db()
        assert user_marketero.tokens_disponibles == creditos  # no cobra crédito
        assert (campana.estado, campana.version) == (CampaignStatus.APROBADO, version)

    def test_solo_para_campanas_aprobadas(self, x_on, user_marketero, campana):
        Campaign.objects.filter(pk=campana.pk).update(estado=CampaignStatus.PENDIENTE_APROBACION)
        response = crear(user_marketero, campana, texto="Hola")
        assert response.status_code == 409
        assert response.data["data"]["motivo"] == "campana_no_aprobada"
        assert not VarianteX.objects.exists()

    def test_texto_con_enlace_se_rechaza_con_el_costo_explicado(self, x_on, user_marketero, campana):
        response = crear(user_marketero, campana, texto="2x1 hoy en cafeaurora.com")
        assert response.status_code == 400
        assert "US$0.20" in response.data["message"] and "cafeaurora.com" in response.data["message"]

    def test_texto_de_281_ponderados_se_rechaza(self, x_on, user_marketero, campana):
        assert crear(user_marketero, campana, texto="a" * 281).status_code == 400
        assert crear(user_marketero, campana, texto="😀" * 140).status_code == 201

    def test_volver_a_generar_reemplaza_la_misma_variante(self, x_on, user_marketero, campana):
        assert crear(user_marketero, campana, texto="Primera").status_code == 201
        response = crear(user_marketero, campana, texto="Segunda")
        assert response.status_code == 200
        assert VarianteX.objects.get().texto == "Segunda"

    def test_otro_marketero_cliente_y_superadmin_no_crean(self, x_on, campana, otro_marketero, cliente, superadmin):
        assert crear(otro_marketero, campana, texto="Hola").status_code == 404
        assert crear(cliente, campana, texto="Hola").status_code == 404
        response = crear(superadmin, campana, texto="Hola")
        assert response.status_code == 403 and response.data["data"]["motivo"] == "solo_lectura"
        assert not VarianteX.objects.exists()


@pytest.mark.django_db
class TestRevisionDelCliente:
    def test_el_cliente_no_ve_borradores_y_aprueba_lo_que_vio(self, x_on, user_marketero, cliente, campana):
        crear(user_marketero, campana, texto="2x1 en capuchinos")
        variante = VarianteX.objects.get()
        assert cliente_api(cliente).get(VARIANTES).data["data"]["variantes"] == []

        cliente_api(user_marketero).post(url_variante(variante, "enviar"))
        lista = cliente_api(cliente).get(VARIANTES, {"estado": "pendiente_cliente"}).data["data"]["variantes"]
        assert [v["id"] for v in lista] == [variante.id]
        hash_visto = lista[0]["hash_texto"]

        response = cliente_api(cliente).post(url_variante(variante, "aprobar"), {"hash_texto": hash_visto},
                                             format="json")
        assert response.status_code == 200
        variante.refresh_from_db()
        assert variante.estado == VarianteXEstado.APROBADA
        assert variante.hash_aprobado == x_texto.hash_texto("2x1 en capuchinos")
        assert variante.aprobada_por == cliente and variante.aprobada_at is not None

    def test_si_el_marketero_cambia_el_texto_mientras_revisa_no_se_aprueba(self, x_on, user_marketero, cliente,
                                                                            campana):
        crear(user_marketero, campana, texto="Texto que vio el cliente")
        variante = VarianteX.objects.get()
        cliente_api(user_marketero).post(url_variante(variante, "enviar"))
        hash_visto = x_texto.hash_texto("Texto que vio el cliente")
        cliente_api(user_marketero).patch(url_variante(variante), {"texto": "Otro texto"}, format="json")
        cliente_api(user_marketero).post(url_variante(variante, "enviar"))
        response = cliente_api(cliente).post(url_variante(variante, "aprobar"), {"hash_texto": hash_visto},
                                             format="json")
        assert response.status_code == 409 and response.data["data"]["motivo"] == "cambio"
        assert cliente_api(cliente).post(url_variante(variante, "aprobar"), {}, format="json").status_code == 409

    def test_cliente_ajeno_y_marketero_no_aprueban(self, x_on, user_marketero, otro_cliente, campana):
        crear(user_marketero, campana, texto="2x1")
        variante = VarianteX.objects.get()
        cliente_api(user_marketero).post(url_variante(variante, "enviar"))
        hash_visto = x_texto.hash_texto("2x1")
        assert cliente_api(otro_cliente).post(url_variante(variante, "aprobar"), {"hash_texto": hash_visto},
                                              format="json").status_code == 404
        assert cliente_api(user_marketero).post(url_variante(variante, "aprobar"), {"hash_texto": hash_visto},
                                                format="json").status_code == 403
        variante.refresh_from_db()
        assert variante.estado == VarianteXEstado.PENDIENTE_CLIENTE

    def test_rechazo_exige_motivo_y_el_marketero_lo_ve(self, x_on, user_marketero, cliente, campana):
        crear(user_marketero, campana, texto="2x1")
        variante = VarianteX.objects.get()
        cliente_api(user_marketero).post(url_variante(variante, "enviar"))
        assert cliente_api(cliente).post(url_variante(variante, "rechazar"), {"feedback": "no"},
                                         format="json").status_code == 400
        response = cliente_api(cliente).post(url_variante(variante, "rechazar"),
                                             {"feedback": "Falta mencionar el horario."}, format="json")
        assert response.status_code == 200
        data = cliente_api(user_marketero).get(url_variante(variante)).data["data"]["variante"]
        assert (data["estado"], data["feedback_cliente"]) == ("rechazada", "Falta mencionar el horario.")

    def test_superadmin_solo_lee(self, x_on, user_marketero, superadmin, campana, cuenta_x):
        crear(user_marketero, campana, texto="2x1")
        variante = VarianteX.objects.get()
        admin = cliente_api(superadmin)
        assert admin.get(url_variante(variante)).status_code == 200
        assert admin.patch(url_variante(variante), {"texto": "x"}, format="json").status_code == 403
        assert admin.post(url_variante(variante, "enviar")).status_code == 403
        response, falso = publicar(superadmin, variante, cuenta_x)
        assert response.status_code == 403 and falso.llamadas == []


@pytest.mark.django_db
class TestEditarTrasAprobar:
    def test_solo_la_variante_vuelve_a_borrador_y_la_campana_no_cambia(self, x_on, user_marketero, cliente, campana):
        variante = aprobada(user_marketero, cliente, campana)
        version, estado = campana.version, campana.estado
        response = cliente_api(user_marketero).patch(url_variante(variante), {"texto": "Nuevo texto para X"},
                                                     format="json")
        assert response.status_code == 200
        variante.refresh_from_db()
        assert variante.estado == VarianteXEstado.BORRADOR
        assert variante.hash_aprobado == "" and variante.aprobada_at is None
        campana.refresh_from_db()
        assert (campana.estado, campana.version) == (estado, version)

    def test_editar_con_enlace_o_por_otro_marketero_se_rechaza(self, x_on, user_marketero, otro_marketero, campana):
        crear(user_marketero, campana, texto="2x1")
        variante = VarianteX.objects.get()
        assert cliente_api(user_marketero).patch(url_variante(variante), {"texto": "ve a www.cafe.pe"},
                                                 format="json").status_code == 400
        assert cliente_api(otro_marketero).patch(url_variante(variante), {"texto": "hola"},
                                                 format="json").status_code == 404
        assert VarianteX.objects.get().texto == "2x1"


@pytest.mark.django_db
class TestPublicar:
    def test_publica_exactamente_lo_aprobado_con_la_imagen(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        version = campana.version
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 200, response.data
        assert falso.rutas() == ["/2/media/upload", "/2/tweets"]

        subida, post = falso.llamadas
        assert subida["headers"] == {"Authorization": "Bearer token-de-pagina"}
        assert subida["json"]["media_category"] == "tweet_image"
        assert base64.b64decode(subida["json"]["media"])[:2] == b"\xff\xd8"  # JPEG
        assert post["json"] == {"text": variante.texto, "media": {"media_ids": [MEDIA_ID]}}

        pub = Publication.objects.get(red=RedSocial.X)
        assert pub.estado == PublicacionEstado.PUBLICADO
        assert pub.copy_aprobado == variante.texto
        assert pub.imagen_aprobada_b64 == campana.imagen_b64
        assert (pub.externo_id, pub.permalink) == (POST_ID, f"https://x.com/agencia/status/{POST_ID}")
        assert (pub.cuenta_id, pub.cuenta_nombre, pub.intentos) == ("999", "@agencia", 1)

        gasto = GastoMensualX.objects.get()
        assert (gasto.publicaciones, gasto.gasto_milesimas) == (1, 15)
        config = cliente_api(user_marketero).get("/api/social/x/config/").data["data"]
        assert (config["usados_mes"], config["restantes"]) == (1, 19)
        campana.refresh_from_db()
        assert (campana.estado, campana.version) == (CampaignStatus.APROBADO, version)

        # Ya publicada: la variante queda como registro y no se edita.
        bloqueo = cliente_api(user_marketero).patch(url_variante(variante), {"texto": "otro"}, format="json")
        assert bloqueo.status_code == 409 and bloqueo.data["data"]["motivo"] == "bloqueada"

    def test_sin_aprobar_409_sin_llamar_a_x(self, x_on, user_marketero, campana, cuenta_x):
        crear(user_marketero, campana, texto="2x1")
        variante = VarianteX.objects.get()
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "sin_aprobar"
        assert falso.llamadas == [] and not GastoMensualX.objects.exists()

    def test_texto_alterado_en_la_base_409(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        VarianteX.objects.filter(pk=variante.pk).update(texto="Texto que el cliente no vio")
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "texto_alterado"
        assert falso.llamadas == [] and not Publication.objects.exists()

    def test_campana_cambiada_despues_de_la_variante_409(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        Campaign.objects.filter(pk=campana.pk).update(texto_generado="Copy distinto")
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "campana_cambiada"
        assert falso.llamadas == []

    def test_sin_confirmar_el_costo_400(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        for confirmo in (False, "true", 1, None):
            response, falso = publicar(user_marketero, variante, cuenta_x, confirmo_costo=confirmo)
            assert response.status_code == 400 and response.data["data"]["motivo"] == "confirmar_costo"
            assert "US$0.015" in response.data["message"]
            assert falso.llamadas == []

    def test_tope_alcanzado_409_sin_llamar_a_x(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        GastoMensualX.objects.create(mes=timezone.localdate().replace(day=1), publicaciones=20, gasto_milesimas=300)
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "tope"
        assert "Quedan 0 de 20" in response.data["message"]
        assert falso.llamadas == [] and not Publication.objects.exists()

    def test_el_tope_cuenta_intentos_de_todas_las_cuentas(self, x_on, user_marketero, cliente, campana, cuenta_x):
        x_on.X_TOPE_MENSUAL_USD = "0.015"  # una sola publicación al mes
        variante = aprobada(user_marketero, cliente, campana)
        assert publicar(user_marketero, variante, cuenta_x)[0].status_code == 200
        del_cliente = conexion(cliente, red=RedSocial.X, cuenta_id="555", cuenta_nombre="@cafe", pagina_id="")
        SocialConnection.objects.filter(pk=del_cliente.pk).update(token_expira_at=timezone.now() + timedelta(hours=1))
        response, falso = publicar(user_marketero, variante, del_cliente)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "tope"
        assert falso.llamadas == []

    def test_doble_publicacion_en_la_misma_cuenta_409(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        assert publicar(user_marketero, variante, cuenta_x)[0].status_code == 200
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "ya_publicada"
        assert falso.llamadas == []
        assert Publication.objects.filter(red=RedSocial.X).count() == 1
        assert GastoMensualX.objects.get().publicaciones == 1

    def test_cuenta_del_cliente_si_y_ajena_o_de_meta_no(self, x_on, user_marketero, cliente, otro_cliente, campana):
        variante = aprobada(user_marketero, cliente, campana)
        ajena = conexion(otro_cliente, red=RedSocial.X, cuenta_id="777", cuenta_nombre="@ajena", pagina_id="")
        instagram = conexion(cliente)
        for cuenta in (ajena, instagram):
            response, falso = publicar(user_marketero, variante, cuenta)
            assert response.status_code == 400 and falso.llamadas == []
        del_cliente = conexion(cliente, red=RedSocial.X, cuenta_id="555", cuenta_nombre="@cafe", pagina_id="")
        SocialConnection.objects.filter(pk=del_cliente.pk).update(token_expira_at=timezone.now() + timedelta(hours=1))
        response, _ = publicar(user_marketero, variante, del_cliente)
        assert response.status_code == 200
        assert Publication.objects.get().permalink == f"https://x.com/cafe/status/{POST_ID}"


@pytest.mark.django_db
class TestRespuestasDeX:
    def test_timeout_al_crear_el_post_es_incierto_y_no_se_reintenta_a_ciegas(self, x_on, user_marketero, cliente,
                                                                             campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        falso = HttpXFalso(**{"/2/tweets": httpx.ReadTimeout("sin respuesta")})
        response, _ = publicar(user_marketero, variante, cuenta_x, falso=falso)
        assert response.status_code == 502
        pub = Publication.objects.get()
        assert pub.estado == PublicacionEstado.FALLIDO and pub.resultado_incierto is True
        assert "Revisa la cuenta de X antes de reintentar" in pub.error

        # Un segundo clic no vuelve a llamar a X ni gasta.
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 409 and response.data["data"]["motivo"] == "incierto"
        assert falso.llamadas == [] and GastoMensualX.objects.get().publicaciones == 1
        # La variante queda bloqueada: el post pudo salir con ese texto.
        assert cliente_api(user_marketero).patch(url_variante(variante), {"texto": "otro"},
                                                 format="json").status_code == 409

        # Tras revisar la cuenta, el marketero lo confirma y recién entonces se reintenta.
        response, falso = publicar(user_marketero, variante, cuenta_x, confirmo_revision=True)
        assert response.status_code == 200 and falso.rutas() == ["/2/media/upload", "/2/tweets"]
        pub.refresh_from_db()
        assert (pub.estado, pub.resultado_incierto, pub.intentos) == (PublicacionEstado.PUBLICADO, False, 2)

    def test_error_500_al_crear_el_post_tambien_es_incierto(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        falso = HttpXFalso(**{"/2/tweets": httpx.Response(503, json={"title": "Service Unavailable"})})
        publicar(user_marketero, variante, cuenta_x, falso=falso)
        assert Publication.objects.get().resultado_incierto is True

    def test_rechazo_confirmado_4xx_permite_reintentar(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        falso = HttpXFalso(**{"/2/tweets": httpx.Response(403, json={"detail": "duplicate content"})})
        response, _ = publicar(user_marketero, variante, cuenta_x, falso=falso)
        assert response.status_code == 502
        pub = Publication.objects.get()
        assert pub.estado == PublicacionEstado.FALLIDO and pub.resultado_incierto is False
        assert "X rechazó la solicitud" in pub.error
        response, _ = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 200

    def test_falla_al_subir_la_imagen_no_es_incierto(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        falso = HttpXFalso(**{"/2/media/upload": httpx.ReadTimeout("lento")})
        response, _ = publicar(user_marketero, variante, cuenta_x, falso=falso)
        assert response.status_code == 502 and falso.rutas() == ["/2/media/upload"]
        assert Publication.objects.get().resultado_incierto is False

    def test_token_rechazado_desconecta_la_cuenta(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        falso = HttpXFalso(**{"/2/media/upload": httpx.Response(401, json={"title": "Unauthorized"})})
        publicar(user_marketero, variante, cuenta_x, falso=falso)
        cuenta_x.refresh_from_db()
        assert cuenta_x.estado == ConexionEstado.DESCONECTADA
        assert "volver a conectarla" in Publication.objects.get().error

    def test_token_vencido_se_renueva_y_se_guarda_el_refresh_rotado(self, x_on, user_marketero, cliente, campana,
                                                                    cuenta_x):
        SocialConnection.objects.filter(pk=cuenta_x.pk).update(token_expira_at=timezone.now() - timedelta(minutes=1))
        variante = aprobada(user_marketero, cliente, campana)
        response, falso = publicar(user_marketero, variante, cuenta_x)
        assert response.status_code == 200
        assert falso.rutas() == ["/2/oauth2/token", "/2/media/upload", "/2/tweets"]
        renovacion = falso.llamadas[0]
        assert renovacion["data"] == {"refresh_token": "refresh-vigente", "grant_type": "refresh_token"}
        assert isinstance(renovacion["auth"], httpx.BasicAuth)
        assert falso.llamadas[1]["headers"] == {"Authorization": "Bearer nuevo-access"}
        cuenta_x.refresh_from_db()
        assert descifrar(cuenta_x.token_cifrado) == "nuevo-access"
        assert descifrar(cuenta_x.refresh_token_cifrado) == "nuevo-refresh"
        assert cuenta_x.token_expira_at > timezone.now() + timedelta(minutes=110)

    def test_renovacion_rechazada_desconecta_y_no_publica(self, x_on, user_marketero, cliente, campana, cuenta_x):
        SocialConnection.objects.filter(pk=cuenta_x.pk).update(token_expira_at=timezone.now() - timedelta(minutes=1))
        variante = aprobada(user_marketero, cliente, campana)
        falso = HttpXFalso(**{"/2/oauth2/token": httpx.Response(400, json={"error": "invalid_request"})})
        response, _ = publicar(user_marketero, variante, cuenta_x, falso=falso)
        assert response.status_code == 502 and falso.rutas() == ["/2/oauth2/token"]
        cuenta_x.refresh_from_db()
        assert cuenta_x.estado == ConexionEstado.DESCONECTADA
        assert Publication.objects.get().resultado_incierto is False


@pytest.mark.django_db
class TestXFueraDeMetaYMetricas:
    def test_metricas_de_x_no_se_leen(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        publicar(user_marketero, variante, cuenta_x)
        pub = Publication.objects.get(red=RedSocial.X)
        with pytest.raises(MetricasNoDisponibles, match="Las métricas de X no se leen para no generar costo"):
            refrescar_metricas(pub)
        with patch.object(x_api.httpx, "request", side_effect=AssertionError("no debe llamar")):
            response = cliente_api(user_marketero).get(f"/api/social/publications/{pub.id}/stats/", {"refresh": 1})
        assert response.data["data"]["aviso"] == "Las métricas de X no se leen para no generar costo"

    def test_resumen_por_red_incluye_x_sin_romperse(self, x_on, user_marketero, cliente, campana, cuenta_x):
        variante = aprobada(user_marketero, cliente, campana)
        publicar(user_marketero, variante, cuenta_x)
        datos = resumen_por_red(Publication.objects.all())
        assert datos["redes"]["x"]["publicaciones"] == 1 and datos["redes"]["x"]["me_gusta"] is None
        assert datos["por_mes"][-1]["x"] == 1
        json.dumps(datos, default=str)  # serializable para la API

    def test_aprobacion_de_meta_no_publica_en_x(self, x_on, campana, user_marketero, cuenta_x):
        pub = publicacion(campana, cuenta_x)  # ni siquiera una fila X 'esperando_aprobacion' se publica sola
        with patch.object(x_api.httpx, "request", side_effect=AssertionError("no debe llamar")):
            resumen = publicar_campana_aprobada(campana.id)
        assert (resumen.publicadas, resumen.fallidas) == (0, 0)
        pub.refresh_from_db()
        assert pub.estado == PublicacionEstado.ESPERANDO_APROBACION


@pytest.mark.django_db
class TestCuentasXDeLaCampana:
    URL = "/api/social/x/destinos/"

    def test_ofrece_las_del_marketero_y_del_cliente_una_por_cuenta(self, x_on, user_marketero, cliente, otro_cliente,
                                                                   campana, cuenta_x):
        conexion(cliente, red=RedSocial.X, cuenta_id="555", cuenta_nombre="@cafe", pagina_id="")
        conexion(cliente, red=RedSocial.X, cuenta_id="999", cuenta_nombre="@agencia", pagina_id="")  # la misma
        conexion(otro_cliente, red=RedSocial.X, cuenta_id="777", cuenta_nombre="@ajena", pagina_id="")
        conexion(cliente)  # Instagram: no es de X
        data = cliente_api(user_marketero).get(self.URL, {"campaign": campana.id}).data["data"]["conexiones"]
        assert sorted((c["cuenta_nombre"], c["propietario_rol"]) for c in data) == [
            ("@agencia", "cliente"), ("@cafe", "cliente"),
        ]

    def test_solo_el_marketero_dueno_y_con_x_encendida(self, x_on, otro_marketero, cliente, campana):
        assert cliente_api(otro_marketero).get(self.URL, {"campaign": campana.id}).status_code == 404
        assert cliente_api(cliente).get(self.URL, {"campaign": campana.id}).status_code == 403
        x_on.X_HABILITADO = False
        assert cliente_api(otro_marketero).get(self.URL, {"campaign": campana.id}).status_code == 403
