"""Tests de Fase 3: conectar cuentas de Meta y publicar lo aprobado. La Graph API se simula."""

from unittest.mock import patch

import pytest
from django.conf import settings
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.campaigns.models import Campaign, CampaignStatus
from apps.social.models import ConexionEstado, PublicacionEstado, Publication, RedSocial, SocialConnection
from services import meta_graph, public_media
from services.mock_assets import MOCK_IMAGE_B64
from services.social_tokens import TokenIlegible, cifrar, descifrar

APPROVED_URL = "/api/internal/campaign-events/approved"


def cliente_api(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def conexion(usuario: User, red: str = RedSocial.INSTAGRAM, cuenta_id: str = "ig-1", **extra) -> SocialConnection:
    return SocialConnection.objects.create(
        usuario=usuario,
        red=red,
        cuenta_id=cuenta_id,
        cuenta_nombre=extra.pop("cuenta_nombre", "@cafe.aurora"),
        pagina_id=extra.pop("pagina_id", "page-1"),
        token_cifrado=cifrar("token-de-pagina"),
        **extra,
    )


@pytest.fixture
def campana(db, user_marketero, cliente) -> Campaign:
    return Campaign.objects.create(
        titulo="2x1 en capuchinos",
        cliente_nombre="Café Aurora",
        cliente_email=cliente.email,
        industria="gastronomia",
        tono="casual",
        plataforma="instagram",
        prompt="Campaña 2x1 para universitarios",
        estado=CampaignStatus.GENERADO,
        texto_generado="Copy aprobado por el cliente",
        imagen_b64=MOCK_IMAGE_B64,
        marketero=user_marketero,
    )


def aprobar(campana: Campaign) -> None:
    Campaign.objects.filter(pk=campana.pk).update(estado=CampaignStatus.APROBADO)
    campana.refresh_from_db()


def evento_aprobado(campaign_id: int, token: str | None = None):
    return APIClient().post(
        APPROVED_URL, {"campaignId": campaign_id}, format="json",
        HTTP_X_INTERNAL_EVENT_TOKEN=token if token is not None else settings.INTERNAL_EVENT_TOKEN,
    )


RESULTADO_OK = meta_graph.ResultadoPublicacion(
    externo_id="media-1", permalink="https://www.instagram.com/p/abc/", contenedor_id="cont-1"
)


class TestTokens:

    def test_sin_token_configurado_el_evento_interno_se_rechaza(self, settings):
        settings.INTERNAL_EVENT_TOKEN = ""
        respuesta = APIClient().post(APPROVED_URL, {"campaignId": 1}, format="json", HTTP_X_INTERNAL_EVENT_TOKEN="")
        assert respuesta.status_code == 403

    def test_cifrar_y_descifrar(self, settings):
        cifrado = cifrar("EAAG-secreto")
        assert "EAAG" not in cifrado
        assert descifrar(cifrado) == "EAAG-secreto"

    def test_dato_corrupto_no_se_lee(self):
        with pytest.raises(TokenIlegible):
            descifrar("no-es-fernet")


@pytest.mark.django_db
class TestConexionesYDestinos:
    def test_lista_solo_las_propias_y_activas_sin_token(self, cliente, user_marketero):
        conexion(cliente)
        conexion(cliente, cuenta_id="ig-2", estado=ConexionEstado.DESCONECTADA)
        conexion(user_marketero, cuenta_id="ig-3")
        data = cliente_api(cliente).get("/api/social/connections/").data["data"]["conexiones"]
        assert [c["cuenta_nombre"] for c in data] == ["@cafe.aurora"]
        assert "token_cifrado" not in data[0]

    def test_desconectar_borra_el_token(self, cliente):
        c = conexion(cliente)
        assert cliente_api(cliente).delete(f"/api/social/connections/{c.id}/").status_code == 200
        c.refresh_from_db()
        assert c.estado == ConexionEstado.DESCONECTADA and c.token_cifrado == ""

    def test_no_se_desconecta_la_cuenta_de_otro(self, cliente, user_marketero):
        c = conexion(cliente)
        assert cliente_api(user_marketero).delete(f"/api/social/connections/{c.id}/").status_code == 404

    def test_destinos_del_marketero_y_del_cliente_pero_no_de_otros(self, api_client, cliente, user_marketero):
        otro = User.objects.create_user(email="otro@test.com", password="Test1234!", nombre="Otro",
                                        rol=UserRole.CLIENTE)
        conexion(cliente, cuenta_nombre="@cliente")
        conexion(user_marketero, cuenta_id="ig-m", cuenta_nombre="@agencia")
        conexion(otro, cuenta_id="ig-o", cuenta_nombre="@ajena")
        data = api_client.get("/api/social/connections/destinos/", {"cliente_email": cliente.email})
        nombres = sorted(c["cuenta_nombre"] for c in data.data["data"]["conexiones"])
        assert nombres == ["@agencia", "@cliente"]

    def test_cliente_no_elige_destinos(self, cliente):
        assert cliente_api(cliente).get("/api/social/connections/destinos/").status_code == 403


@pytest.mark.django_db
class TestEnviarConDestinos:
    def test_submit_programa_la_publicacion(self, api_client, campana, cliente):
        c = conexion(cliente)
        with patch("apps.campaigns.views.notify_campaign_submitted"):
            response = api_client.post(f"/api/campaigns/{campana.id}/submit/", {"destinos": [c.id]}, format="json")
        assert response.status_code == 200
        assert response.data["data"]["destinos"][0]["cuenta_nombre"] == "@cafe.aurora"
        publicacion = Publication.objects.get(campaign=campana)
        assert publicacion.estado == PublicacionEstado.ESPERANDO_APROBACION

    def test_destino_ajeno_400_y_la_campana_no_se_envia(self, api_client, campana, db):
        ajeno = User.objects.create_user(email="otro@test.com", password="Test1234!", nombre="Otro",
                                         rol=UserRole.CLIENTE)
        c = conexion(ajeno)
        response = api_client.post(f"/api/campaigns/{campana.id}/submit/", {"destinos": [c.id]}, format="json")
        assert response.status_code == 400
        campana.refresh_from_db()
        assert campana.estado == CampaignStatus.GENERADO
        assert not Publication.objects.exists()

    @pytest.mark.parametrize("destinos", ["1", [True], ["1"]])
    def test_destinos_mal_formados_400(self, api_client, campana, destinos):
        response = api_client.post(f"/api/campaigns/{campana.id}/submit/", {"destinos": destinos}, format="json")
        assert response.status_code == 400

    def test_sin_destinos_funciona_como_antes(self, api_client, campana):
        with patch("apps.campaigns.views.notify_campaign_submitted"):
            assert api_client.post(f"/api/campaigns/{campana.id}/submit/").status_code == 200
        assert not Publication.objects.exists()


@pytest.mark.django_db
class TestPublicarAlAprobar:
    @pytest.fixture
    def programada(self, campana, cliente, user_marketero) -> Publication:
        return Publication.objects.create(
            campaign=campana, conexion=conexion(cliente), red=RedSocial.INSTAGRAM,
            cuenta_nombre="@cafe.aurora", solicitada_por=user_marketero,
        )

    def test_token_interno_invalido_403(self, programada):
        assert evento_aprobado(programada.campaign_id, token="falso").status_code == 403

    def test_publica_lo_aprobado_y_guarda_el_enlace(self, programada):
        aprobar(programada.campaign)
        with patch.object(meta_graph, "publicar_instagram", return_value=RESULTADO_OK) as publicar:
            response = evento_aprobado(programada.campaign_id)

        assert response.data["data"]["publicadas"] == 1
        ig_id, token, imagen_url, caption = publicar.call_args.args
        assert (ig_id, token, caption) == ("ig-1", "token-de-pagina", "Copy aprobado por el cliente")
        assert "/api/public/media/" in imagen_url and imagen_url.endswith(".jpg")
        programada.refresh_from_db()
        assert programada.estado == PublicacionEstado.PUBLICADO
        assert programada.permalink == "https://www.instagram.com/p/abc/"
        assert programada.copy_aprobado == "Copy aprobado por el cliente"
        assert programada.version_aprobada == programada.campaign.version

    def test_aviso_repetido_no_publica_dos_veces(self, programada):
        aprobar(programada.campaign)
        with patch.object(meta_graph, "publicar_instagram", return_value=RESULTADO_OK) as publicar:
            evento_aprobado(programada.campaign_id)
            segundo = evento_aprobado(programada.campaign_id)
        assert publicar.call_count == 1
        assert segundo.data["data"]["publicadas"] == 0

    def test_campana_no_aprobada_no_se_publica(self, programada):
        with patch.object(meta_graph, "publicar_instagram") as publicar:
            evento_aprobado(programada.campaign_id)
        publicar.assert_not_called()
        programada.refresh_from_db()
        assert programada.estado == PublicacionEstado.ESPERANDO_APROBACION

    def test_facebook_usa_la_pagina(self, campana, cliente):
        c = conexion(cliente, red=RedSocial.FACEBOOK, cuenta_id="page-1", cuenta_nombre="Café Aurora")
        Publication.objects.create(campaign=campana, conexion=c, red=RedSocial.FACEBOOK, cuenta_nombre="Café")
        aprobar(campana)
        resultado = meta_graph.ResultadoPublicacion(externo_id="page-1_99", permalink="https://facebook.com/p/99")
        with patch.object(meta_graph, "publicar_facebook", return_value=resultado) as publicar:
            evento_aprobado(campana.id)
        assert publicar.call_args.args[0] == "page-1"

    def test_token_revocado_marca_fallida_y_desconecta(self, programada):
        aprobar(programada.campaign)
        error = meta_graph.MetaError("Error validating access token", codigo=190)
        with patch.object(meta_graph, "publicar_instagram", side_effect=error):
            response = evento_aprobado(programada.campaign_id)
        assert response.data["data"]["fallidas"] == 1
        programada.refresh_from_db()
        assert programada.estado == PublicacionEstado.FALLIDO
        assert "volver a autorizarla" in programada.error
        assert programada.conexion.estado == ConexionEstado.DESCONECTADA

    def test_reintento_publica_el_contenido_congelado(self, programada, user_marketero):
        aprobar(programada.campaign)
        with patch.object(meta_graph, "publicar_instagram", side_effect=meta_graph.MetaError("caído")):
            evento_aprobado(programada.campaign_id)
        Campaign.objects.filter(pk=programada.campaign_id).update(texto_generado="Texto cambiado después")

        # Reintento sin contenedor: primero se busca si el intento anterior llegó a publicar.
        with patch.object(meta_graph, "buscar_publicacion_instagram", return_value=None) as buscar, \
                patch.object(meta_graph, "publicar_instagram", return_value=RESULTADO_OK) as publicar:
            response = cliente_api(user_marketero).post(f"/api/social/publications/{programada.id}/publish/")

        assert response.status_code == 200
        assert buscar.call_args.args[2] == "Copy aprobado por el cliente"
        assert publicar.call_args.args[3] == "Copy aprobado por el cliente"
        programada.refresh_from_db()
        assert programada.estado == PublicacionEstado.PUBLICADO and programada.intentos == 2

    def test_fallo_ambiguo_no_republica_si_el_contenedor_ya_salio(self, programada, user_marketero):
        aprobar(programada.campaign)
        error = meta_graph.MetaError("Meta no respondió a tiempo.", ambiguo=True)
        error.contenedor_id = "cont-9"
        with patch.object(meta_graph, "publicar_instagram", side_effect=error):
            evento_aprobado(programada.campaign_id)
        programada.refresh_from_db()
        assert programada.contenedor_id == "cont-9" and "incierto" in programada.error

        encontrado = meta_graph.ResultadoPublicacion(externo_id="media-9", permalink="https://www.instagram.com/p/9/")
        with patch.object(meta_graph, "estado_contenedor", return_value="PUBLISHED"), \
                patch.object(meta_graph, "buscar_publicacion_instagram", return_value=encontrado), \
                patch.object(meta_graph, "publicar_instagram") as publicar:
            cliente_api(user_marketero).post(f"/api/social/publications/{programada.id}/publish/")
        publicar.assert_not_called()
        programada.refresh_from_db()
        assert programada.estado == PublicacionEstado.PUBLICADO
        # Antes quedaba publicado sin id: sin enlace ni métricas.
        assert (programada.externo_id, programada.permalink) == ("media-9", "https://www.instagram.com/p/9/")
        assert programada.contenedor_id == "cont-9" and programada.error == ""

    def test_reintento_requiere_aprobacion_y_ser_el_dueno(self, programada, cliente):
        assert cliente_api(cliente).post(f"/api/social/publications/{programada.id}/publish/").status_code == 403
        with patch.object(meta_graph, "publicar_instagram") as publicar:
            response = cliente_api(programada.campaign.marketero).post(
                f"/api/social/publications/{programada.id}/publish/"
            )
        assert response.status_code == 409
        publicar.assert_not_called()

    def test_lista_publicaciones_de_la_campana(self, programada, api_client):
        data = api_client.get("/api/social/publications/", {"campaign": programada.campaign_id}).data
        assert [p["cuenta_nombre"] for p in data["data"]["publicaciones"]] == ["@cafe.aurora"]


@pytest.mark.django_db
class TestImagenPublica:
    @pytest.fixture
    def publicacion(self, campana) -> Publication:
        return Publication.objects.create(
            campaign=campana, red=RedSocial.INSTAGRAM, cuenta_nombre="@x", imagen_aprobada_b64=MOCK_IMAGE_B64,
        )

    def test_sirve_jpeg_con_firma_valida(self, publicacion):
        response = APIClient().get(f"/api/public/media/{public_media.firmar(publicacion.id)}.jpg")
        assert response.status_code == 200
        assert response["Content-Type"] == "image/jpeg"
        assert response.content[:3] == b"\xff\xd8\xff"

    def test_firma_manipulada_404(self, publicacion):
        token = public_media.firmar(publicacion.id)
        assert APIClient().get(f"/api/public/media/{token[:-2]}xx.jpg").status_code == 404

    def test_firma_caducada_404(self, publicacion, settings):
        token = public_media.firmar(publicacion.id)
        settings.PUBLIC_MEDIA_MAX_AGE = -1
        assert APIClient().get(f"/api/public/media/{token}.jpg").status_code == 404

    def test_sin_imagen_404(self, campana):
        p = Publication.objects.create(campaign=campana, red=RedSocial.INSTAGRAM, cuenta_nombre="@x")
        assert APIClient().get(f"/api/public/media/{public_media.firmar(p.id)}.jpg").status_code == 404


class TestClienteGraph:
    def test_instagram_espera_el_contenedor_y_publica(self):
        respuestas = iter([
            {"id": "cont-1"}, {"status_code": "IN_PROGRESS"}, {"status_code": "FINISHED"},
            {"id": "media-1"}, {"permalink": "https://www.instagram.com/p/x/"},
        ])
        with patch.object(meta_graph, "_graph", side_effect=lambda *a, **k: next(respuestas)) as graph:
            resultado = meta_graph.publicar_instagram("ig-1", "tok", "https://img/x.jpg", "hola", esperar=lambda s: None)
        assert resultado.externo_id == "media-1" and resultado.contenedor_id == "cont-1"
        assert graph.call_args_list[3].args[:2] == ("POST", "ig-1/media_publish")

    def test_contenedor_con_error_no_se_publica_y_conserva_el_id(self):
        respuestas = iter([{"id": "cont-1"}, {"status_code": "ERROR"}])
        with patch.object(meta_graph, "_graph", side_effect=lambda *a, **k: next(respuestas)):
            with pytest.raises(meta_graph.MetaError) as exc:
                meta_graph.publicar_instagram("ig-1", "tok", "https://img/x.jpg", "hola", esperar=lambda s: None)
        assert exc.value.contenedor_id == "cont-1"


@pytest.mark.django_db
class TestEdicionYVersion:
    def test_editar_sube_la_version(self, api_client, campana):
        version = campana.version
        api_client.patch(
            f"/api/campaigns/{campana.id}/", {"texto_generado": "Nuevo copy", "version": version}, format="json"
        )
        campana.refresh_from_db()
        assert campana.version == version + 1

    def test_mejorar_texto_sube_la_version(self, api_client, campana):
        version = campana.version
        api_client.post(f"/api/campaigns/{campana.id}/improve-text/")
        campana.refresh_from_db()
        assert campana.version == version + 1

    def test_no_se_mejora_una_campana_aprobada(self, api_client, campana):
        aprobar(campana)
        assert api_client.post(f"/api/campaigns/{campana.id}/improve-text/").status_code == 409
        campana.refresh_from_db()
        assert campana.texto_generado == "Copy aprobado por el cliente"


# ── Fase 4: estadísticas ─────────────────────────────────────────────────

from datetime import timedelta  # noqa: E402

from django.utils import timezone  # noqa: E402

from apps.social.models import PublicationMetric  # noqa: E402
from services import metrics_service  # noqa: E402

METRICAS_IG = {"me_gusta": 12, "comentarios": 3, "compartidos": 1, "guardados": 2, "alcance": 140,
               "vistas": 210, "interacciones": 18, "crudo": {"fuente": "test"}}


@pytest.mark.django_db
class TestMetricas:
    @pytest.fixture
    def publicada(self, campana, cliente, user_marketero) -> Publication:
        aprobar(campana)
        return Publication.objects.create(
            campaign=campana, conexion=conexion(cliente), red=RedSocial.INSTAGRAM, cuenta_nombre="@cafe.aurora",
            estado=PublicacionEstado.PUBLICADO, externo_id="media-1", publicado_at=timezone.now(),
            solicitada_por=user_marketero,
        )

    def test_refresca_y_respeta_el_intervalo_minimo(self, publicada):
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)) as meta:
            primera = metrics_service.refrescar_metricas(publicada)
            segunda = metrics_service.refrescar_metricas(publicada)
        assert meta.call_count == 1
        assert primera.pk == segunda.pk
        assert (primera.me_gusta, primera.alcance, primera.crudo) == (12, 140, {"fuente": "test"})

    def test_pasado_el_intervalo_toma_otra_foto(self, publicada):
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)):
            primera = metrics_service.refrescar_metricas(publicada)
        PublicationMetric.objects.filter(pk=primera.pk).update(obtenida_at=timezone.now() - timedelta(minutes=11))
        with patch.object(meta_graph, "metricas_instagram", return_value={**METRICAS_IG, "me_gusta": 20}):
            nueva = metrics_service.refrescar_metricas(publicada)
        assert nueva.pk != primera.pk and nueva.me_gusta == 20

    def test_publicacion_sin_publicar_no_tiene_metricas(self, campana):
        p = Publication.objects.create(campaign=campana, red=RedSocial.INSTAGRAM, cuenta_nombre="@x")
        with pytest.raises(metrics_service.MetricasNoDisponibles):
            metrics_service.refrescar_metricas(p)

    def test_error_de_meta_conserva_la_ultima_foto(self, publicada):
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)):
            primera = metrics_service.refrescar_metricas(publicada)
        with patch.object(meta_graph, "metricas_instagram", side_effect=meta_graph.MetaError("límite")):
            assert metrics_service.refrescar_metricas(publicada, forzar=True).pk == primera.pk

    def test_endpoint_stats_refresca_y_devuelve_historial(self, publicada, api_client):
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)):
            data = api_client.get(f"/api/social/publications/{publicada.id}/stats/", {"refresh": "1"}).data["data"]
        assert data["publicacion"]["ultima_metrica"]["me_gusta"] == 12
        assert len(data["historial"]) == 1 and data["aviso"] == ""

    def test_endpoint_stats_avisa_si_no_hay_datos(self, publicada, api_client):
        with patch.object(meta_graph, "metricas_instagram", side_effect=meta_graph.MetaError("sin datos")):
            data = api_client.get(f"/api/social/publications/{publicada.id}/stats/", {"refresh": "1"}).data["data"]
        assert data["aviso"] == "sin datos" and data["historial"] == []

    def test_resumen_por_red_suma_ignorando_lo_que_meta_no_informa(self, publicada, campana, cliente, api_client):
        otra_ig = Publication.objects.create(
            campaign=campana, conexion=conexion(cliente, cuenta_id="ig-2"), red=RedSocial.INSTAGRAM,
            cuenta_nombre="@otra", estado=PublicacionEstado.PUBLICADO, externo_id="media-2",
            publicado_at=timezone.now(),
        )
        Publication.objects.create(
            campaign=campana, conexion=conexion(cliente, red=RedSocial.FACEBOOK, cuenta_id="page-1"),
            red=RedSocial.FACEBOOK, cuenta_nombre="Café", estado=PublicacionEstado.PUBLICADO,
            externo_id="p_1", publicado_at=timezone.now(),
        )
        PublicationMetric.objects.create(publicacion=publicada, me_gusta=10, compartidos=None)
        PublicationMetric.objects.create(publicacion=otra_ig, me_gusta=5, compartidos=None)

        data = api_client.get("/api/social/publications/summary/").data["data"]

        instagram, facebook = data["redes"]["instagram"], data["redes"]["facebook"]
        assert (instagram["publicaciones"], instagram["me_gusta"], instagram["compartidos"]) == (2, 15, None)
        assert (facebook["publicaciones"], facebook["con_metricas"], facebook["me_gusta"]) == (1, 0, None)
        assert data["total_publicaciones"] == 3
        mes = timezone.now().strftime("%Y-%m")
        assert data["por_mes"][-1] == {"mes": mes, "instagram": 2, "facebook": 1, "x": 0}

    def test_resumen_solo_cuenta_las_campanas_del_marketero(self, publicada, db):
        otro = User.objects.create_user(email="otro.mk@test.com", password="Test1234!", nombre="Otro",
                                        rol=UserRole.MARKETERO)
        data = cliente_api(otro).get("/api/social/publications/summary/").data["data"]
        assert data["total_publicaciones"] == 0

    def test_historial_incluye_titulo_y_ultima_metrica(self, publicada, api_client):
        PublicationMetric.objects.create(publicacion=publicada, me_gusta=7)
        data = api_client.get("/api/social/publications/", {"estado": "publicado"}).data["data"]["publicaciones"]
        assert data[0]["campaign_titulo"] == "2x1 en capuchinos"
        assert data[0]["ultima_metrica"]["me_gusta"] == 7

    def test_historial_incluye_cliente_y_marketero(self, publicada, api_client, user_marketero):
        data = api_client.get("/api/social/publications/").data["data"]["publicaciones"]
        assert data[0]["cliente_nombre"] == publicada.campaign.cliente_nombre
        assert data[0]["marketero_nombre"] == user_marketero.nombre

    def test_stats_muestra_lo_que_se_publico(self, publicada, api_client):
        Publication.objects.filter(pk=publicada.pk).update(copy_aprobado="Copy aprobado", imagen_aprobada_b64="iVBOR")
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)):
            detalle = api_client.get(f"/api/social/publications/{publicada.id}/stats/").data["data"]["publicacion"]
        assert detalle["copy_aprobado"] == "Copy aprobado"
        assert detalle["imagen_url"].startswith("http://testserver/api/public/media/")

    def test_imagen_usa_la_direccion_publica_si_esta_configurada(self, publicada, settings):
        from services import public_media
        settings.PUBLIC_BASE_URL = "https://tunel.example.dev/"
        assert public_media.url_publica(publicada.id).startswith("https://tunel.example.dev/api/public/media/")
        settings.PUBLIC_BASE_URL = ""
        assert public_media.url_publica(publicada.id).startswith("http://testserver/api/public/media/")

    def test_stats_sin_imagen_aprobada_no_da_url(self, publicada, api_client):
        detalle = api_client.get(f"/api/social/publications/{publicada.id}/stats/").data["data"]["publicacion"]
        assert detalle["imagen_url"] is None

    def test_actualizar_metricas_solo_toca_las_publicadas(self, publicada, campana, api_client):
        Publication.objects.create(campaign=campana, red=RedSocial.INSTAGRAM, cuenta_nombre="@pendiente")
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)) as meta:
            data = api_client.post("/api/social/publications/refresh/").data["data"]
        assert data == {"actualizadas": 1, "sin_datos": 0}
        assert meta.call_count == 1
        assert PublicationMetric.objects.filter(publicacion=publicada).count() == 1

    def test_actualizar_metricas_no_toca_publicaciones_ajenas(self, publicada, db):
        otro = User.objects.create_user(email="otro.mk2@test.com", password="Test1234!", nombre="Otro",
                                        rol=UserRole.MARKETERO)
        with patch.object(meta_graph, "metricas_instagram", return_value=dict(METRICAS_IG)) as meta:
            data = cliente_api(otro).post("/api/social/publications/refresh/").data["data"]
        assert data == {"actualizadas": 0, "sin_datos": 0}
        assert meta.call_count == 0

    def test_resumen_indica_la_fecha_de_las_metricas(self, publicada, api_client):
        metrica = PublicationMetric.objects.create(publicacion=publicada, me_gusta=4)
        instagram = api_client.get("/api/social/publications/summary/").data["data"]["redes"]["instagram"]
        assert instagram["metricas_al"] == metrica.obtenida_at
        facebook = api_client.get("/api/social/publications/summary/").data["data"]["redes"]["facebook"]
        assert facebook["metricas_al"] is None


class TestLecturaDeMetricasEnMeta:
    def test_instagram_combina_contadores_e_insights(self):
        respuestas = iter([
            {"like_count": 9, "comments_count": 2},
            {"data": [{"name": "likes", "values": [{"value": 11}]}, {"name": "reach", "values": [{"value": 80}]},
                      {"name": "total_interactions", "total_value": {"value": 15}}]},
        ])
        with patch.object(meta_graph, "_graph", side_effect=lambda *a, **k: next(respuestas)):
            datos = meta_graph.metricas_instagram("media-1", "tok")
        assert (datos["me_gusta"], datos["comentarios"], datos["alcance"], datos["interacciones"]) == (11, 2, 80, 15)
        assert datos["guardados"] is None

    def test_instagram_sin_insights_usa_los_contadores_y_deja_null_el_resto(self):
        def graph(metodo, ruta, **params):
            if ruta.endswith("/insights"):
                raise meta_graph.MetaError("Media posted before business account conversion")
            return {"like_count": 4, "comments_count": 1}
        with patch.object(meta_graph, "_graph", side_effect=graph):
            datos = meta_graph.metricas_instagram("media-1", "tok")
        assert (datos["me_gusta"], datos["comentarios"], datos["alcance"]) == (4, 1, None)
        assert "insights_error" in datos["crudo"]

    def test_facebook_lee_reacciones_y_no_inventa_compartidos(self):
        respuestas = iter([
            {"reactions": {"summary": {"total_count": 6}}, "comments": {"summary": {"total_count": 2}}},
            {"data": [{"name": "post_media_view", "values": [{"value": 50}]}]},
        ])
        with patch.object(meta_graph, "_graph", side_effect=lambda *a, **k: next(respuestas)):
            datos = meta_graph.metricas_facebook("page_1", "tok")
        assert (datos["me_gusta"], datos["comentarios"], datos["vistas"]) == (6, 2, 50)
        assert datos["compartidos"] is None


@pytest.mark.django_db
class TestVistasPorRol:
    """Dashboard en tres niveles: cliente lo suyo, marketero sus clientes, superadmin todo."""

    @pytest.fixture
    def dos_clientes(self, campana, cliente, user_marketero):
        otro = User.objects.create_user(email="otro.cliente@test.com", password="Test1234!", nombre="Otro",
                                        rol=UserRole.CLIENTE)
        otra_campana = Campaign.objects.create(
            titulo="Campaña de otro cliente", cliente_nombre="Otro", cliente_email=otro.email, industria="moda",
            tono="casual", plataforma="instagram", prompt="prompt suficientemente largo",
            estado=CampaignStatus.APROBADO, marketero=user_marketero,
        )
        for camp, nombre in [(campana, "@cafe"), (otra_campana, "@otro")]:
            Publication.objects.create(campaign=camp, red=RedSocial.INSTAGRAM, cuenta_nombre=nombre,
                                       estado=PublicacionEstado.PUBLICADO, publicado_at=timezone.now())
        return otro

    def _nombres(self, user):
        data = cliente_api(user).get("/api/social/publications/").data["data"]["publicaciones"]
        return sorted(p["cuenta_nombre"] for p in data)

    def test_cliente_ve_solo_sus_publicaciones(self, dos_clientes, cliente):
        assert self._nombres(cliente) == ["@cafe"]
        assert self._nombres(dos_clientes) == ["@otro"]

    def test_marketero_ve_las_de_todos_sus_clientes(self, dos_clientes, user_marketero):
        assert self._nombres(user_marketero) == ["@cafe", "@otro"]

    def test_superadmin_ve_todo_y_el_resumen_lo_refleja(self, dos_clientes, superadmin):
        assert self._nombres(superadmin) == ["@cafe", "@otro"]
        resumen = cliente_api(superadmin).get("/api/social/publications/summary/").data["data"]
        assert resumen["total_publicaciones"] == 2

    def test_resumen_del_cliente_solo_cuenta_lo_suyo(self, dos_clientes, cliente):
        resumen = cliente_api(cliente).get("/api/social/publications/summary/").data["data"]
        assert resumen["total_publicaciones"] == 1
