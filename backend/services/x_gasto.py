"""
Tope de gasto mensual en la API de X, aplicado en el servidor.

La API de X es de pago por uso (https://docs.x.com/x-api/getting-started/pricing,
consultada el 2026-10-17): Post: Create US$0.015 por request, User: Read
US$0.010. La subida de imágenes no figura en la tabla y no se cuenta aparte.

Cada llamada que cuesta se reserva ANTES de hacerla con un único UPDATE
condicional (`gasto + costo <= tope`), igual que los créditos en
credit_service: dos peticiones simultáneas no pueden pasar el tope. Es
conservador: un intento que llega a llamar a X cuenta aunque X lo rechace.
Los montos se guardan en milésimas de dólar (enteros) para que la comparación
sea exacta en PostgreSQL y en el SQLite de los tests.
El tope de NexoMark no reemplaza al "spending limit" de la consola de X.
"""

from dataclasses import asdict, dataclass
from datetime import date
from decimal import ROUND_CEILING, Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.social.models import GastoMensualX

MILESIMAS = Decimal("1000")


def _milesimas(valor) -> int:
    """'0.015' → 15. Redondea hacia arriba: un costo nunca se subestima."""
    try:
        return int((Decimal(str(valor)) * MILESIMAS).to_integral_value(rounding=ROUND_CEILING))
    except (InvalidOperation, ValueError):
        return 0


def _usd(milesimas: int) -> str:
    return f"{Decimal(milesimas) / MILESIMAS:.3f}"


def costo_post() -> int:
    return _milesimas(settings.X_COSTO_POST_USD)


def costo_lectura() -> int:
    return _milesimas(settings.X_COSTO_LECTURA_USD)


def tope_mensual() -> int:
    return _milesimas(settings.X_TOPE_MENSUAL_USD)


def mes_actual() -> date:
    return timezone.localdate().replace(day=1)


def _fila_del_mes() -> GastoMensualX:
    mes = mes_actual()
    fila = GastoMensualX.objects.filter(mes=mes).first()
    if fila is not None:
        return fila
    try:
        with transaction.atomic():
            return GastoMensualX.objects.create(mes=mes)
    except IntegrityError:  # otra petición la creó a la vez
        return GastoMensualX.objects.get(mes=mes)


def _reservar(costo: int, campo: str) -> bool:
    fila = _fila_del_mes()
    reservado = GastoMensualX.objects.filter(pk=fila.pk, gasto_milesimas__lte=tope_mensual() - costo).update(
        gasto_milesimas=F("gasto_milesimas") + costo,
        **{campo: F(campo) + 1},
        fecha_actualizacion=timezone.now(),
    )
    return reservado == 1


def reservar_publicacion() -> bool:
    """Reserva el costo de un intento de publicación. False: se alcanzó el tope del mes."""
    return _reservar(costo_post(), "publicaciones")


def reservar_lectura() -> bool:
    """Reserva el costo de leer el usuario al conectar (GET /2/users/me)."""
    return _reservar(costo_lectura(), "lecturas")


def _gasto_del_mes() -> int:
    fila = GastoMensualX.objects.filter(mes=mes_actual()).first()
    return fila.gasto_milesimas if fila else 0


def hay_margen_para_lectura() -> bool:
    """Para no empezar una conexión que no podrá terminar por el tope (solo orienta; reservar decide)."""
    return _gasto_del_mes() + costo_lectura() <= tope_mensual()


@dataclass
class EstadoGasto:
    habilitado: bool
    costo_post_usd: str
    tope_mensual_usd: str
    gasto_mes_usd: str
    usados_mes: int
    restantes: int
    maximo_mes: int

    def como_dict(self) -> dict:
        return asdict(self)


def estado() -> EstadoGasto:
    """Lo que muestra la UI: costo por post, tope, gasto del mes y posts que quedan."""
    fila = GastoMensualX.objects.filter(mes=mes_actual()).first()
    gasto = fila.gasto_milesimas if fila else 0
    costo, tope = costo_post(), tope_mensual()
    return EstadoGasto(
        habilitado=bool(settings.X_HABILITADO),
        costo_post_usd=_usd(costo),
        tope_mensual_usd=_usd(tope),
        gasto_mes_usd=_usd(gasto),
        usados_mes=fila.publicaciones if fila else 0,
        restantes=max((tope - gasto) // costo, 0) if costo > 0 else 0,
        maximo_mes=tope // costo if costo > 0 else 0,
    )
