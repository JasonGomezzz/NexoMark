"""
Créditos de IA: planes, costo por generación y operaciones atómicas.

Planes de lanzamiento (decisión del equipo, 6 nov 2026; precios mensuales sin IGV):

    Freelance     S/59  · 100 créditos  · hasta 25 generaciones
    Agencia       S/149 · 400 créditos  · hasta 100 generaciones
    Agencia Plus  S/299 · 1000 créditos · hasta 250 generaciones (próximamente)

Reglas de consumo:
    - Generar o regenerar texto + imagen: GENERATION_CREDIT_COST (4) créditos.
    - Editar a mano, enviar, aprobar, consultar y publicar en varias redes: gratis.
    - Fallo técnico sin contenido: se devuelve lo cobrado en ese intento
      (Campaign.creditos_intento), no la tarifa vigente.

Cada cambio de saldo es un único UPDATE con F(): dos peticiones simultáneas no
pueden gastar dos veces el mismo saldo, y el cobro solo ocurre si alcanza
(`tokens_disponibles >= costo` en el mismo UPDATE).

Esta es la fuente única: la web y el móvil leen el costo y los planes del API
(`costo_generacion` en /api/auth/me/ y GET /api/campaigns/credits/plans/).
"""

from decimal import Decimal
from typing import TypedDict

from django.db.models import F

from apps.authentication.models import User

GENERATION_CREDIT_COST: int = 4
"""Créditos que cuesta una generación o regeneración de texto + imagen."""

DEFAULT_PLAN_KEY: str = "freelance"


class CreditPlan(TypedDict):
    nombre: str
    precio: Decimal
    creditos: int
    disponible: bool
    destacado: bool


CREDIT_PLANS: dict[str, CreditPlan] = {
    "freelance": {
        "nombre": "Freelance",
        "precio": Decimal("59"),
        "creditos": 100,
        "disponible": True,
        "destacado": False,
    },
    "agencia": {
        "nombre": "Agencia",
        "precio": Decimal("149"),
        "creditos": 400,
        "disponible": True,
        "destacado": True,
    },
    "agencia_plus": {
        "nombre": "Agencia Plus",
        "precio": Decimal("299"),
        "creditos": 1000,
        # Se vende cuando existan multiusuario e imagen HQ.
        "disponible": False,
        "destacado": False,
    },
}


def generaciones(creditos: int | None) -> int | None:
    """Generaciones completas que alcanzan con `creditos` (None si no hay dato)."""
    if creditos is None:
        return None
    return max(creditos, 0) // GENERATION_CREDIT_COST


def cuota_del_plan(plan_key: str | None) -> int:
    """Créditos mensuales del plan; si el plan no existe, los de Freelance."""
    plan = CREDIT_PLANS.get(plan_key or "") or CREDIT_PLANS[DEFAULT_PLAN_KEY]
    return plan["creditos"]


def plan_publico(key: str) -> dict:
    """Representación JSON de un plan para web y móvil."""
    plan = CREDIT_PLANS[key]
    return {
        "key": key,
        "nombre": plan["nombre"],
        "precio": int(plan["precio"]),
        "creditos": plan["creditos"],
        "generaciones": generaciones(plan["creditos"]),
        "disponible": plan["disponible"],
        "destacado": plan["destacado"],
    }


def alcanza_para_generar(user: User) -> bool:
    """True si el saldo cubre una generación completa."""
    return user.tokens_disponibles >= GENERATION_CREDIT_COST


def mensaje_sin_saldo(user: User) -> str:
    """Texto para el HTTP 402: qué pasó y qué hacer."""
    return (
        f"Necesitas {GENERATION_CREDIT_COST} créditos para generar y te quedan "
        f"{max(user.tokens_disponibles, 0)}. Elige un plan o pide créditos al administrador."
    )


def datos_sin_saldo(user: User) -> dict:
    return {
        "tokens_disponibles": max(user.tokens_disponibles, 0),
        "costo_generacion": GENERATION_CREDIT_COST,
    }


def consumir_credito(user: User, cantidad: int = GENERATION_CREDIT_COST) -> bool:
    """Descuenta `cantidad` si hay saldo suficiente. Devuelve False (sin cobrar) si no."""
    cobrado = User.objects.filter(pk=user.pk, tokens_disponibles__gte=cantidad).update(
        tokens_disponibles=F("tokens_disponibles") - cantidad
    )
    user.refresh_from_db(fields=["tokens_disponibles"])
    return cobrado == 1


def agregar_creditos(user: User, cantidad: int = GENERATION_CREDIT_COST) -> None:
    """Devuelve o suma créditos sin pisar cambios concurrentes."""
    User.objects.filter(pk=user.pk).update(tokens_disponibles=F("tokens_disponibles") + cantidad)
    user.refresh_from_db(fields=["tokens_disponibles"])


def creditos_a_devolver(creditos_intento: int) -> int:
    """
    Lo que se devuelve cuando falla un intento.

    Los intentos anteriores a este cambio no guardaron su costo (0) y cobraron 1.
    """
    return creditos_intento if creditos_intento > 0 else 1
