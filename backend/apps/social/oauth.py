"""
OAuth de Meta a prueba de CSRF y de vinculación cruzada de cuentas.

1. `iniciar`: el usuario autenticado pide conectar; se crea un state aleatorio
   de un solo uso, ligado a él y a su token_version, que caduca en 10 minutos.
   Solo se guarda su sha256.
2. Meta devuelve el navegador al callback de Django (sin JWT, por el túnel
   HTTPS). `vigente_para_callback` solo comprueba que el state exista, no se
   haya usado y no haya caducado: el callback NO canjea el código, lo pasa al
   frontend en el fragmento de la URL (#), que no llega a ningún servidor.
3. El frontend, con el JWT del usuario, presenta code + state. `reclamar`
   exige que el state sea de ese usuario y que su token_version no haya
   cambiado, y lo marca usado con un UPDATE condicional (atómico). Recién
   entonces se canjea el código.

Así un atacante no puede hacer que la víctima termine el flujo con un state
ajeno (vincularía la cuenta de Meta del atacante a la víctima) ni usar el
código de la víctima con su propio state.

X usa el mismo flujo con PKCE (RFC 7636): `iniciar` recibe además el
code_verifier, que se guarda cifrado en la autorización (nunca viaja por el
navegador; solo su sha256, el code_challenge). `reclamar` lo borra de la base
en el mismo UPDATE que marca el state usado.
"""

import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from apps.authentication.models import User
from services.social_tokens import cifrar, descifrar

from .models import OAuthAutorizacion, ProveedorOAuth

VIGENCIA = timedelta(minutes=10)
# Las autorizaciones viejas solo sirven de rastro un día; luego se borran.
RETENCION = timedelta(days=1)


def hash_state(state: str) -> str:
    return hashlib.sha256(state.encode()).hexdigest()


def iniciar(
    usuario: User, redirect_uri: str, proveedor: str = ProveedorOAuth.META, code_verifier: str = ""
) -> str:
    """Crea la autorización y devuelve el state en claro (solo viaja en la URL del proveedor)."""
    ahora = timezone.now()
    OAuthAutorizacion.objects.filter(usuario=usuario, expira_at__lt=ahora - RETENCION).delete()
    state = secrets.token_urlsafe(32)
    OAuthAutorizacion.objects.create(
        usuario=usuario,
        proveedor=proveedor,
        state_hash=hash_state(state),
        token_version=usuario.token_version,
        redirect_uri=redirect_uri,
        code_verifier_cifrado=cifrar(code_verifier) if code_verifier else "",
        expira_at=ahora + VIGENCIA,
    )
    return state


def leer_code_verifier(autorizacion: OAuthAutorizacion) -> str:
    """El code_verifier (PKCE) de una autorización reclamada. Lanza TokenIlegible si no se puede leer."""
    if not autorizacion.code_verifier_cifrado:
        return ""
    return descifrar(autorizacion.code_verifier_cifrado)


def vigente_para_callback(state: str, proveedor: str = ProveedorOAuth.META) -> OAuthAutorizacion | None:
    if not state or len(state) > 512:
        return None
    return OAuthAutorizacion.objects.filter(
        state_hash=hash_state(state),
        proveedor=proveedor,
        usada_at__isnull=True,
        expira_at__gt=timezone.now(),
    ).first()


def cancelar(state: str, proveedor: str = ProveedorOAuth.META) -> None:
    """El usuario canceló en Meta: ese state ya no sirve."""
    if state and len(state) <= 512:
        OAuthAutorizacion.objects.filter(
            state_hash=hash_state(state), proveedor=proveedor, usada_at__isnull=True
        ).update(usada_at=timezone.now())


class AutorizacionInvalida(Exception):
    def __init__(self, motivo: str, mensaje: str, status: int):
        super().__init__(mensaje)
        self.motivo = motivo
        self.mensaje = mensaje
        self.status = status


def reclamar(usuario: User, state: str, proveedor: str = ProveedorOAuth.META) -> OAuthAutorizacion:
    """Valida que el state sea del usuario autenticado y lo marca usado. Lanza AutorizacionInvalida."""
    autorizacion = None
    if state and len(state) <= 512:
        autorizacion = OAuthAutorizacion.objects.filter(state_hash=hash_state(state), proveedor=proveedor).first()
    if autorizacion is None:
        raise AutorizacionInvalida(
            "desconocida", "El enlace de conexión no es válido. Vuelve a conectar la cuenta desde Redes conectadas.", 400
        )
    if autorizacion.usuario_id != usuario.id:
        raise AutorizacionInvalida(
            "ajena",
            "Esta conexión se inició con otra cuenta de NexoMark. Inicia sesión con esa cuenta "
            "o vuelve a conectar desde la tuya.",
            403,
        )
    if autorizacion.usada_at is not None:
        raise AutorizacionInvalida(
            "usada", "Este enlace de conexión ya se usó. Si falta alguna cuenta, vuelve a conectarla.", 409
        )
    ahora = timezone.now()
    if autorizacion.expira_at <= ahora:
        raise AutorizacionInvalida(
            "caducada", "El enlace de conexión caducó (dura 10 minutos). Vuelve a conectar la cuenta.", 400
        )
    if autorizacion.token_version != usuario.token_version:
        raise AutorizacionInvalida(
            "sesion",
            "Tu sesión cambió desde que iniciaste la conexión. Vuelve a conectar la cuenta.",
            403,
        )
    # Un solo uso aunque lleguen dos peticiones a la vez: solo una actualiza la fila.
    # El code_verifier (PKCE) sale de la base en el mismo UPDATE; queda solo en memoria.
    reclamada = OAuthAutorizacion.objects.filter(
        pk=autorizacion.pk, usada_at__isnull=True, expira_at__gt=ahora
    ).update(usada_at=ahora, code_verifier_cifrado="")
    if not reclamada:
        raise AutorizacionInvalida(
            "usada", "Este enlace de conexión ya se usó. Si falta alguna cuenta, vuelve a conectarla.", 409
        )
    autorizacion.usada_at = ahora
    return autorizacion
