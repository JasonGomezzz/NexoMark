"""
X opcional: interruptor, OAuth 2.0 con PKCE y exclusión de la publicación automática.

La API de X se simula siempre (services.x_api._x o httpx.request): ningún test
llama a X de verdad.
"""

import base64
import hashlib
import logging
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.authentication.models import User, UserRole
from apps.social import oauth
from apps.social.log_filters import redactar
from apps.social.models import (
    ConexionEstado,
    GastoMensualX,
    OAuthAutorizacion,
    ProveedorOAuth,
    RedSocial,
    SocialConnection,
)
from services import x_api
from services.publication_service import (
    DestinoInvalido,
    PublicacionNoPermitida,
    programar_publicaciones,
    reintentar_publicacion,
)
from services.social_tokens import descifrar

from .datos import cliente_api, conexion, publicacion

CONFIG = "/api/social/x/config/"
CONNECT = "/api/social/x/connect/"
CALLBACK = "/api/social/x/callback/"
COMPLETE = "/api/social/x/complete/"
TOKENS = {
    "token_type": "bearer", "expires_in": 7200, "access_token": "x-access", "refresh_token": "x-refresh",
    "scope": "tweet.read tweet.write users.read media.write offline.access",
}
PERFIL = {"data": {"id": "1234567890", "username": "nexomarkia", "name": "NexoMark IA"}}


@pytest.fixture
def x_on(settings):
    settings.X_HABILITADO = True
    return settings


class XFalso:
    """Reemplaza x_api._x: registra cada llamada y responde según la ruta."""

    def __init__(self, tokens=None, perfil=None, error_en: str | None = None):
        self.llamadas: list[dict] = []
        self.tokens = tokens or TOKENS
        self.perfil = perfil or PERFIL
        self.error_en = error_en

    def __call__(self, metodo, ruta, **kwargs):
        self.llamadas.append({"metodo": metodo, "ruta": ruta, **kwargs})
        if self.error_en == ruta:
            raise x_api.XError("rechazado", status=400)
        if ruta == "/2/oauth2/token":
            return 200, dict(self.tokens)
        if ruta == "/2/users/me":
            return 200, self.perfil
        raise AssertionError(f"Llamada inesperada a X: {metodo} {ruta}")

    def rutas(self) -> list[str]:
        return [c["ruta"] for c in self.llamadas]


def iniciar(user: User) -> tuple[str, dict]:
    """Pide la URL de X como el frontend y devuelve (state, parámetros de la URL)."""
    response = cliente_api(user).get(CONNECT)
    assert response.status_code == 200, response.data
    url = urlparse(response.data["data"]["url"])
    params = {k: v[0] for k, v in parse_qs(url.query).items()}
    return params["state"], params


def fragmento(response) -> dict[str, str]:
    destino = urlparse(response["Location"])
    return {k: v[0] for k, v in parse_qs(destino.fragment).items()}


@pytest.fixture
def otro_cliente(db) -> User:
    return User.objects.create_user(email="atacante@test.com", password="Test1234!", nombre="Atacante",
                                    rol=UserRole.CLIENTE)


@pytest.mark.django_db
class TestXApagada:
    def test_config_informa_apagada_con_costo_y_tope(self, api_client):
        data = api_client.get(CONFIG).data["data"]
        assert data["habilitado"] is False
        assert data["costo_post_usd"] == "0.015"
        assert data["tope_mensual_usd"] == "0.300"
        assert (data["usados_mes"], data["restantes"], data["maximo_mes"]) == (0, 20, 20)

    def test_connect_y_complete_responden_403_claro(self, api_client):
        for response in (api_client.get(CONNECT), api_client.post(COMPLETE, {"code": "c", "state": "s"})):
            assert response.status_code == 403
            assert response.data["message"] == "X está desactivado en este servidor."
        assert not OAuthAutorizacion.objects.exists()

    def test_callback_vuelve_al_frontend_con_error(self, db):
        response = APIClient().get(CALLBACK, {"code": "abc", "state": "s"})
        assert response.status_code == 302
        assert fragmento(response) == {"error": "desactivado"}

    def test_conexiones_x_guardadas_no_aparecen_en_redes_conectadas(self, api_client, user_marketero):
        conexion(user_marketero, red=RedSocial.X, cuenta_id="999", cuenta_nombre="@agencia", pagina_id="")
        conexion(user_marketero)
        redes = [c["red"] for c in api_client.get("/api/social/connections/").data["data"]["conexiones"]]
        assert redes == ["instagram"]

    def test_con_x_encendida_si_aparecen(self, x_on, api_client, user_marketero):
        conexion(user_marketero, red=RedSocial.X, cuenta_id="999", cuenta_nombre="@agencia", pagina_id="")
        redes = {c["red"] for c in api_client.get("/api/social/connections/").data["data"]["conexiones"]}
        assert redes == {"x"}


@pytest.mark.django_db
class TestIniciarX:
    def test_url_con_pkce_s256_scopes_y_state_de_un_solo_uso(self, x_on, user_marketero):
        state, params = iniciar(user_marketero)
        assert params["response_type"] == "code"
        assert params["client_id"] == "test-x-client"
        assert params["redirect_uri"] == "http://testserver/api/social/x/callback/"
        assert set(params["scope"].split()) == {
            "tweet.read", "tweet.write", "users.read", "media.write", "offline.access"
        }
        assert params["code_challenge_method"] == "S256"

        autorizacion = OAuthAutorizacion.objects.get(usuario=user_marketero)
        assert autorizacion.proveedor == ProveedorOAuth.X
        assert autorizacion.state_hash == hashlib.sha256(state.encode()).hexdigest() != state
        # El verifier se guarda cifrado y nunca viaja: solo su sha256 (code_challenge) va en la URL.
        verifier = descifrar(autorizacion.code_verifier_cifrado)
        assert 43 <= len(verifier) <= 128
        assert verifier not in params.values()
        esperado = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        assert params["code_challenge"] == esperado

    def test_cada_intento_tiene_state_y_verifier_propios(self, x_on, cliente):
        iniciar(cliente)
        iniciar(cliente)
        verifiers = {descifrar(a.code_verifier_cifrado) for a in OAuthAutorizacion.objects.filter(usuario=cliente)}
        assert len(verifiers) == 2

    def test_superadmin_no_conecta(self, x_on, superadmin_client):
        assert superadmin_client.get(CONNECT).status_code == 403

    def test_sin_credenciales_503(self, x_on, api_client):
        x_on.X_CLIENT_SECRET = ""
        assert api_client.get(CONNECT).status_code == 503

    def test_sin_margen_en_el_tope_no_empieza(self, x_on, api_client):
        GastoMensualX.objects.create(mes=timezone.localdate().replace(day=1), gasto_milesimas=295)
        response = api_client.get(CONNECT)
        assert response.status_code == 409
        assert response.data["data"]["motivo"] == "tope"


@pytest.mark.django_db
class TestCallbackX:
    def test_no_canjea_y_pasa_code_y_state_en_el_fragmento(self, x_on, cliente):
        state, _ = iniciar(cliente)
        falso = XFalso()
        with patch.object(x_api, "_x", falso):
            response = APIClient().get(CALLBACK, {"code": "abc", "state": state})
        assert falso.llamadas == []
        destino = urlparse(response["Location"])
        assert f"{destino.scheme}://{destino.netloc}{destino.path}" == "http://frontend.test/redes/x-retorno"
        assert destino.query == ""
        assert fragmento(response) == {"code": "abc", "state": state}
        assert response["Cache-Control"] == "no-store"

    def test_state_de_meta_no_sirve_para_x(self, x_on, cliente):
        state_meta = oauth.iniciar(cliente, "http://testserver/api/social/meta/callback/")
        assert fragmento(APIClient().get(CALLBACK, {"code": "abc", "state": state_meta})) == {"error": "sesion"}

    def test_state_caducado_o_usado(self, x_on, cliente):
        state, _ = iniciar(cliente)
        OAuthAutorizacion.objects.update(expira_at=timezone.now() - timedelta(seconds=1))
        assert fragmento(APIClient().get(CALLBACK, {"code": "abc", "state": state})) == {"error": "sesion"}
        state, _ = iniciar(cliente)
        OAuthAutorizacion.objects.update(usada_at=timezone.now())
        assert fragmento(APIClient().get(CALLBACK, {"code": "abc", "state": state})) == {"error": "sesion"}

    def test_cancelado_en_x_invalida_el_state(self, x_on, cliente):
        state, _ = iniciar(cliente)
        response = APIClient().get(CALLBACK, {"error": "access_denied", "state": state})
        assert fragmento(response) == {"error": "cancelado"}
        assert OAuthAutorizacion.objects.get().usada_at is not None


@pytest.mark.django_db
class TestCompletarX:
    def completar(self, user, state, code="abc", falso=None):
        falso = falso or XFalso()
        with patch.object(x_api, "_x", falso):
            response = cliente_api(user).post(COMPLETE, {"code": code, "state": state}, format="json")
        return response, falso

    def test_canjea_con_el_code_verifier_y_guarda_tokens_cifrados(self, x_on, cliente):
        state, _ = iniciar(cliente)
        verifier = descifrar(OAuthAutorizacion.objects.get().code_verifier_cifrado)
        response, falso = self.completar(cliente, state)
        assert response.status_code == 200, response.data
        assert falso.rutas() == ["/2/oauth2/token", "/2/users/me"]

        canje = falso.llamadas[0]
        assert canje["metodo"] == "POST" and canje["cliente"] is True  # Basic con id:secret
        assert canje["data"] == {
            "code": "abc", "grant_type": "authorization_code",
            "redirect_uri": "http://testserver/api/social/x/callback/", "code_verifier": verifier,
        }
        assert "client_id" not in canje["data"]  # cliente confidencial: va en la cabecera Basic
        assert falso.llamadas[1]["token"] == "x-access"

        con = SocialConnection.objects.get(red=RedSocial.X)
        assert (con.usuario, con.cuenta_id, con.cuenta_nombre, con.pagina_id) == (cliente, "1234567890",
                                                                                 "@nexomarkia", "")
        assert con.token_cifrado != "x-access" and descifrar(con.token_cifrado) == "x-access"
        assert descifrar(con.refresh_token_cifrado) == "x-refresh"
        assert timedelta(minutes=119) < con.token_expira_at - timezone.now() <= timedelta(hours=2)
        assert "token" not in str(response.data["data"]["conexiones"])

        autorizacion = OAuthAutorizacion.objects.get()
        assert autorizacion.usada_at is not None
        assert autorizacion.code_verifier_cifrado == ""  # el verifier ya no queda en la base

        gasto = GastoMensualX.objects.get()
        assert (gasto.lecturas, gasto.publicaciones, gasto.gasto_milesimas) == (1, 0, 10)

    def test_el_codigo_y_la_cabecera_basic_llegan_asi_a_x(self, x_on, cliente):
        """Petición HTTP real que arma _x (httpx simulado): form-urlencoded y Basic auth."""
        state, _ = iniciar(cliente)
        respuestas = iter([httpx.Response(200, json=TOKENS), httpx.Response(200, json=PERFIL)])
        with patch.object(x_api.httpx, "request", side_effect=lambda *a, **k: next(respuestas)) as request:
            response = cliente_api(cliente).post(COMPLETE, {"code": "abc", "state": state}, format="json")
        assert response.status_code == 200
        metodo, url = request.call_args_list[0].args
        kwargs = request.call_args_list[0].kwargs
        assert (metodo, url) == ("POST", "https://api.x.com/2/oauth2/token")
        assert isinstance(kwargs["auth"], httpx.BasicAuth)
        assert kwargs["data"]["code_verifier"] and kwargs["json"] is None
        assert request.call_args_list[1].args == ("GET", "https://api.x.com/2/users/me")
        assert request.call_args_list[1].kwargs["headers"] == {"Authorization": "Bearer x-access"}

    def test_reconectar_actualiza_la_misma_conexion(self, x_on, cliente):
        state, _ = iniciar(cliente)
        self.completar(cliente, state)
        SocialConnection.objects.update(estado=ConexionEstado.DESCONECTADA, token_cifrado="")
        state, _ = iniciar(cliente)
        response, _ = self.completar(cliente, state)
        assert response.status_code == 200
        con = SocialConnection.objects.get()
        assert con.estado == ConexionEstado.ACTIVA and descifrar(con.token_cifrado) == "x-access"

    def test_state_ajeno_no_canjea(self, x_on, cliente, otro_cliente):
        state, _ = iniciar(cliente)
        response, falso = self.completar(otro_cliente, state)
        assert response.status_code == 403
        assert response.data["data"]["motivo"] == "ajena"
        assert falso.llamadas == []
        assert not SocialConnection.objects.exists()

    def test_state_usado_no_canjea_dos_veces(self, x_on, cliente):
        state, _ = iniciar(cliente)
        assert self.completar(cliente, state)[0].status_code == 200
        response, falso = self.completar(cliente, state)
        assert response.status_code == 409
        assert falso.llamadas == []

    def test_state_caducado(self, x_on, cliente):
        state, _ = iniciar(cliente)
        OAuthAutorizacion.objects.update(expira_at=timezone.now() - timedelta(seconds=1))
        response, falso = self.completar(cliente, state)
        assert response.status_code == 400 and response.data["data"]["motivo"] == "caducada"
        assert falso.llamadas == []

    def test_state_de_meta_no_completa_x(self, x_on, cliente):
        state_meta = oauth.iniciar(cliente, "http://testserver/api/social/meta/callback/")
        response, falso = self.completar(cliente, state_meta)
        assert response.status_code == 400 and response.data["data"]["motivo"] == "desconocida"
        assert falso.llamadas == []

    def test_sesion_invalidada_desde_que_inicio(self, x_on, cliente):
        state, _ = iniciar(cliente)
        User.objects.filter(pk=cliente.pk).update(token_version=cliente.token_version + 1)
        cliente.refresh_from_db()
        response, falso = self.completar(cliente, state)
        assert response.status_code == 403 and falso.llamadas == []

    def test_x_rechaza_el_codigo(self, x_on, cliente):
        state, _ = iniciar(cliente)
        response, falso = self.completar(cliente, state, falso=XFalso(error_en="/2/oauth2/token"))
        assert response.status_code == 502
        assert falso.rutas() == ["/2/oauth2/token"]
        assert not SocialConnection.objects.exists()

    def test_sin_permisos_de_publicar_no_conecta(self, x_on, cliente):
        state, _ = iniciar(cliente)
        falso = XFalso(tokens={**TOKENS, "scope": "tweet.read users.read offline.access"})
        response, _ = self.completar(cliente, state, falso=falso)
        assert response.status_code == 422
        assert "tweet.write" in response.data["message"] and "media.write" in response.data["message"]
        assert falso.rutas() == ["/2/oauth2/token"]

    def test_tope_alcanzado_no_lee_el_usuario(self, x_on, cliente):
        state, _ = iniciar(cliente)
        GastoMensualX.objects.create(mes=timezone.localdate().replace(day=1), gasto_milesimas=295)
        response, falso = self.completar(cliente, state)
        assert response.status_code == 409
        assert falso.rutas() == ["/2/oauth2/token"]
        assert not SocialConnection.objects.exists()


@pytest.mark.django_db
class TestXFueraDeLaPublicacionAutomatica:
    def test_destinos_no_ofrece_cuentas_de_x(self, x_on, api_client, user_marketero, cliente):
        conexion(cliente)
        conexion(cliente, red=RedSocial.X, cuenta_id="111", cuenta_nombre="@cafe", pagina_id="")
        conexion(user_marketero, red=RedSocial.X, cuenta_id="222", cuenta_nombre="@agencia", pagina_id="")
        response = api_client.get("/api/social/connections/destinos/", {"cliente_email": cliente.email})
        assert [c["red"] for c in response.data["data"]["conexiones"]] == ["instagram"]

    def test_programar_rechaza_ids_de_x(self, x_on, campana, user_marketero, cliente):
        x = conexion(cliente, red=RedSocial.X, cuenta_id="111", cuenta_nombre="@cafe", pagina_id="")
        ig = conexion(cliente)
        with pytest.raises(DestinoInvalido, match="X y TikTok no se publican al aprobar"):
            programar_publicaciones(campana, [ig.id, x.id], user_marketero)

    def test_submit_con_destino_x_responde_400_y_no_envia(self, x_on, api_client, user_marketero, cliente):
        from apps.campaigns.models import Campaign, CampaignStatus

        campana = Campaign.objects.create(
            titulo="Lanzamiento", cliente_nombre="Café", cliente_email=cliente.email, industria="retail",
            prompt="p", estado=CampaignStatus.GENERADO, texto_generado="Copy", marketero=user_marketero,
        )
        x = conexion(cliente, red=RedSocial.X, cuenta_id="111", cuenta_nombre="@cafe", pagina_id="")
        response = api_client.post(f"/api/campaigns/{campana.id}/submit/", {"destinos": [x.id]}, format="json")
        assert response.status_code == 400
        campana.refresh_from_db()
        assert campana.estado == CampaignStatus.GENERADO

    def test_reintentar_de_meta_no_publica_en_x(self, x_on, campana, user_marketero):
        x = conexion(user_marketero, red=RedSocial.X, cuenta_id="222", cuenta_nombre="@agencia", pagina_id="")
        pub = publicacion(campana, x, estado="fallido")
        with pytest.raises(PublicacionNoPermitida, match="versión para X"):
            reintentar_publicacion(pub, user_marketero)


def test_el_filtro_de_logs_oculta_secretos_de_x():
    linea = "POST /2/oauth2/token code=abc&code_verifier=xyz&refresh_token=r1&state=s1"
    assert redactar(linea) == (
        "POST /2/oauth2/token code=[filtrado]&code_verifier=[filtrado]&refresh_token=[filtrado]&state=[filtrado]"
    )
    registro = logging.LogRecord("django.server", logging.INFO, "", 0,
                                 '"GET /api/social/x/callback/?state=s&code=c HTTP/1.1" 302', (), None)
    from apps.social.log_filters import FiltroSecretosOAuth

    FiltroSecretosOAuth().filter(registro)
    assert "code=c" not in registro.getMessage() and "state=s" not in registro.getMessage()
