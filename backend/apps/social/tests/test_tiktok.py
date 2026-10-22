"""TikTok (Sandbox): conectar, enviar al buzón sin duplicados y consultar el estado. La API se simula."""

from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.social.models import OAuthAutorizacion, PlataformaOAuth, PublicacionEstado, Publication, RedSocial
from services import public_media, tiktok_api, tiktok_service
from services.metrics_service import MetricasNoDisponibles, refrescar_metricas

from .datos import cliente_api, conexion

pytestmark = pytest.mark.django_db


def tokens(open_id="tt-1", expira_en=timedelta(hours=24)) -> tiktok_api.Tokens:
    ahora = timezone.now()
    return tiktok_api.Tokens(
        access="access-tt", refresh="refresh-tt", open_id=open_id, expira_at=ahora + expira_en,
        refresh_expira_at=ahora + timedelta(days=365), permisos=["user.info.basic", "video.upload"],
    )


@pytest.fixture
def medios(settings):
    settings.TIKTOK_MEDIA_VERIFIED = True
    settings.PUBLIC_BASE_URL = "https://demo.ngrok.test"


@pytest.fixture
def cuenta_cliente(cliente):
    return tiktok_service.guardar_conexion(cliente, tokens(), "Café Aurora")


def enviar(user, campana, cuenta, **extra):
    datos = {"campaign": campana.id, "conexion": cuenta.id, "confirmo": True, **extra}
    return cliente_api(user).post("/api/social/tiktok/enviar/", datos, format="json")


class TestConectar:
    def test_config_sin_dominio_verificado(self, cliente):
        datos = cliente_api(cliente).get("/api/social/tiktok/config/").data["data"]
        assert datos["configurado"] is True and datos["medios_verificados"] is False
        assert datos["max_texto"] == 4000

    def test_desde_la_app_vuelve_por_el_esquema_y_solo_su_dueno_canjea(self, cliente):
        url = cliente_api(cliente).get("/api/social/tiktok/connect/", {"plataforma": "app"}).data["data"]["url"]
        params = parse_qs(urlparse(url).query)
        assert params["scope"] == ["user.info.basic,video.upload"]
        state = params["state"][0]
        assert OAuthAutorizacion.objects.get().plataforma == PlataformaOAuth.APP

        retorno = APIClient().get("/api/social/tiktok/callback/", {"code": "c0de", "state": state})
        assert retorno["Location"].startswith("nexomark://oauth/tiktok#")

        atacante = User.objects.create_user(email="otro@test.com", password="Test1234!", nombre="Otro",
                                            rol=UserRole.CLIENTE)
        with patch.object(tiktok_api, "canjear_codigo") as canjear:
            ajeno = cliente_api(atacante).post("/api/social/tiktok/complete/", {"code": "c0de", "state": state})
        assert ajeno.status_code == 403
        canjear.assert_not_called()

        with patch.object(tiktok_api, "canjear_codigo", return_value=(tokens(), "Café Aurora")):
            propio = cliente_api(cliente).post("/api/social/tiktok/complete/", {"code": "c0de", "state": state})
        assert propio.status_code == 200
        guardada = propio.data["data"]["conexiones"][0]
        assert (guardada["red"], guardada["cuenta_nombre"]) == ("tiktok", "Café Aurora")

    def test_sin_credenciales_503(self, cliente, settings):
        settings.TIKTOK_CLIENT_KEY = ""
        assert cliente_api(cliente).get("/api/social/tiktok/connect/").status_code == 503


class TestFueraDeLaPublicacionAutomatica:
    def test_no_aparece_en_destinos_de_meta(self, api_client, cliente, cuenta_cliente):
        conexion(cliente)
        destinos = api_client.get("/api/social/connections/destinos/", {"cliente_email": cliente.email})
        redes = {c["red"] for c in destinos.data["data"]["conexiones"]}
        assert redes == {"instagram"}

    def test_destinos_de_tiktok_del_cliente(self, api_client, campana, cuenta_cliente):
        datos = api_client.get("/api/social/tiktok/destinos/", {"campaign": campana.id}).data["data"]
        assert [c["id"] for c in datos["conexiones"]] == [cuenta_cliente.id]

    def test_no_se_reintenta_como_meta(self, api_client, campana, cuenta_cliente):
        pub = Publication.objects.create(
            campaign=campana, conexion=cuenta_cliente, red=RedSocial.TIKTOK, cuenta_id=cuenta_cliente.cuenta_id,
            cuenta_nombre="Café Aurora", estado=PublicacionEstado.FALLIDO, version_aprobada=campana.version,
        )
        response = api_client.post(f"/api/social/publications/{pub.id}/publish/")
        assert response.status_code in (400, 409)
        assert "TikTok" in response.data["message"]

    def test_sin_metricas(self, campana, cuenta_cliente):
        pub = Publication.objects.create(
            campaign=campana, conexion=cuenta_cliente, red=RedSocial.TIKTOK, cuenta_id=cuenta_cliente.cuenta_id,
            cuenta_nombre="Café Aurora", estado=PublicacionEstado.PUBLICADO, externo_id="p-1",
        )
        with pytest.raises(MetricasNoDisponibles, match="TikTok no entrega métricas"):
            refrescar_metricas(pub)


class TestEnviar:
    def test_exige_confirmacion_dominio_verificado_y_campana_aprobada(
        self, user_marketero, campana, cuenta_cliente, settings
    ):
        assert enviar(user_marketero, campana, cuenta_cliente, confirmo=False).status_code == 400
        assert enviar(user_marketero, campana, cuenta_cliente).status_code == 503  # dominio sin verificar
        settings.TIKTOK_MEDIA_VERIFIED, settings.PUBLIC_BASE_URL = True, "https://demo.ngrok.test"
        campana.estado = "pendiente_aprobacion"
        campana.save(update_fields=["estado"])
        assert enviar(user_marketero, campana, cuenta_cliente).status_code == 409
        assert not Publication.objects.exists()

    def test_envia_lo_aprobado_una_sola_vez(self, user_marketero, campana, cuenta_cliente, medios):
        with patch.object(tiktok_api, "enviar_foto", return_value="pub-123") as envio:
            primera = enviar(user_marketero, campana, cuenta_cliente)
            segunda = enviar(user_marketero, campana, cuenta_cliente)
        assert primera.status_code == 201 and segunda.status_code == 200
        assert segunda.data["data"]["nueva"] is False
        envio.assert_called_once()
        token, texto, url = envio.call_args.args
        assert token == "access-tt" and texto == "Copy aprobado"
        pub = Publication.objects.get()
        assert url == public_media.url_publica(pub.id)
        assert url.startswith("https://demo.ngrok.test/api/public/media/")
        assert (pub.red, pub.estado, pub.externo_id) == ("tiktok", "publicando", "pub-123")
        assert pub.imagen_aprobada_b64 == campana.imagen_b64

    def test_respuesta_ambigua_no_se_reenvia(self, user_marketero, campana, cuenta_cliente, medios):
        with patch.object(tiktok_api, "enviar_foto", side_effect=tiktok_api.TikTokIncierto("timeout")):
            response = enviar(user_marketero, campana, cuenta_cliente)
        pub = Publication.objects.get()
        assert pub.estado == "fallido" and pub.resultado_incierto is True
        assert "no lo reenviamos" in response.data["message"]
        with patch.object(tiktok_api, "enviar_foto") as envio:
            enviar(user_marketero, campana, cuenta_cliente)
        envio.assert_not_called()

    def test_rechazo_de_tiktok_queda_como_fallido(self, user_marketero, campana, cuenta_cliente, medios):
        with patch.object(tiktok_api, "enviar_foto", side_effect=tiktok_api.TikTokError("TikTok rechazó la solicitud.")):
            enviar(user_marketero, campana, cuenta_cliente)
        pub = Publication.objects.get()
        assert pub.estado == "fallido" and pub.resultado_incierto is False
        assert "rechazó" in pub.error

    def test_texto_de_mas_de_4000_no_se_recorta(self, user_marketero, campana, cuenta_cliente, medios):
        campana.texto_generado = "a" * 4001
        campana.save(update_fields=["texto_generado"])
        assert enviar(user_marketero, campana, cuenta_cliente).status_code == 400

    def test_cuenta_ajena_o_cliente_no_envia(self, user_marketero, campana, cliente, medios):
        extrano = User.objects.create_user(email="x@test.com", password="Test1234!", nombre="X", rol=UserRole.CLIENTE)
        ajena = tiktok_service.guardar_conexion(extrano, tokens("tt-9"), "Ajena")
        assert enviar(user_marketero, campana, ajena).status_code == 400
        propia = tiktok_service.guardar_conexion(cliente, tokens(), "Café Aurora")
        assert enviar(cliente, campana, propia).status_code == 403

    def test_renueva_el_token_vencido(self, user_marketero, campana, cliente, medios):
        cuenta = tiktok_service.guardar_conexion(cliente, tokens(expira_en=timedelta(seconds=5)), "Café Aurora")
        nuevos = tokens()
        nuevos.access = "access-nuevo"
        with patch.object(tiktok_api, "renovar", return_value=nuevos) as renovar, \
                patch.object(tiktok_api, "enviar_foto", return_value="pub-1") as envio:
            enviar(user_marketero, campana, cuenta)
        renovar.assert_called_once()
        assert envio.call_args.args[0] == "access-nuevo"


class TestEstado:
    @pytest.fixture
    def enviada(self, user_marketero, campana, cuenta_cliente, medios):
        with patch.object(tiktok_api, "enviar_foto", return_value="pub-123"):
            enviar(user_marketero, campana, cuenta_cliente)
        return Publication.objects.get()

    def consultar(self, user, pub):
        return cliente_api(user).post(f"/api/social/tiktok/estado/{pub.id}/")

    def test_buzon_y_luego_publicado_con_limite_de_30_s(self, user_marketero, enviada):
        with patch.object(tiktok_api, "consultar_estado", return_value=("en_buzon", "")) as consulta:
            assert self.consultar(user_marketero, enviada).data["data"]["publicacion"]["estado"] == "en_buzon"
            demasiado_pronto = self.consultar(user_marketero, enviada)
        assert consulta.call_count == 1
        assert "30 segundos" in demasiado_pronto.data["message"]

        Publication.objects.filter(pk=enviada.pk).update(consultado_at=timezone.now() - timedelta(seconds=31))
        with patch.object(tiktok_api, "consultar_estado", return_value=("publicado", "")):
            datos = self.consultar(user_marketero, enviada).data["data"]["publicacion"]
        assert datos["estado"] == "publicado" and datos["publicado_at"] is not None

    def test_lectura_fallida_no_cambia_el_estado(self, user_marketero, enviada):
        with patch.object(tiktok_api, "consultar_estado", side_effect=tiktok_api.TikTokIncierto("red")):
            response = self.consultar(user_marketero, enviada)
        assert "no reenvíes" in response.data["message"]
        enviada.refresh_from_db()
        assert enviada.estado == "publicando"

    def test_fallo_de_tiktok_con_motivo(self, user_marketero, enviada):
        with patch.object(tiktok_api, "consultar_estado", return_value=("fallido", "picture_size_check_failed")):
            datos = self.consultar(user_marketero, enviada).data["data"]["publicacion"]
        assert datos["estado"] == "fallido" and "picture_size_check_failed" in datos["error"]

    def test_solo_el_marketero_de_la_campana(self, cliente, enviada):
        assert self.consultar(cliente, enviada).status_code == 404


class TestVerificacion:
    def test_solo_el_archivo_configurado(self, settings, tmp_path):
        archivo = tmp_path / "tiktokABCDEF0123456789XYZ.txt"
        archivo.write_text("tiktok-developers-site-verification=abc")
        settings.TIKTOK_VERIFICATION_FILE = str(archivo)
        ok = APIClient().get("/api/public/media/tiktokABCDEF0123456789XYZ.txt")
        assert ok.status_code == 200 and b"verification" in ok.content
        assert APIClient().get("/api/public/media/tiktokOTRO0123456789ABCDEF.txt").status_code == 404
        assert APIClient().get("/api/public/media/passwd.txt").status_code == 404
