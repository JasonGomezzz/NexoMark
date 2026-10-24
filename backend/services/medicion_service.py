"""
Medición voz vs. formulario para la tesis, con los datos de `CampaignIntent`.

Los dos caminos terminan en la misma intención (dictar o escribir el brief →
la IA propone campos → la persona corrige → confirma), así que se comparan
con las mismas métricas:

- tasa de finalización: confirmadas / todas las intenciones del grupo;
- tiempo de captura: lo que tardó en dictar o escribir el brief (`captura_ms`,
  lo informa el cliente; las intenciones viejas no lo tienen);
- tiempo de revisión: desde que la IA propuso los campos hasta confirmar;
- correcciones: campos que la persona cambió respecto de lo que propuso la IA,
  en total y por campo (solo intenciones confirmadas);
- campos vacíos: lo que la IA no encontró en el brief.

Regla del proyecto: un dato que no existe es None ("sin dato"), nunca 0. Los
tiempos se resumen con la mediana, que no se deja arrastrar por una sesión que
quedó abierta. No se exporta el texto del brief ni quién lo escribió.
"""

import csv
import io
from statistics import mean, median

from django.db.models import QuerySet

from apps.campaigns.models import CampaignIntent, IntentEstado, IntentOrigen

CAMPOS = ["titulo", "cliente_nombre", "cliente_email", "industria", "tono", "plataforma", "prompt"]


def _vacio(valor) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def campos_corregidos(intent: CampaignIntent) -> list[str]:
    """Campos cuyo valor final difiere del que propuso la IA (ignorando espacios)."""
    propuestos = intent.campos_interpretados or {}
    finales = intent.campos_finales or {}
    cambiados = []
    for campo in CAMPOS:
        antes = (propuestos.get(campo) or "").strip() if isinstance(propuestos.get(campo), str) else propuestos.get(campo)
        despues = (finales.get(campo) or "").strip() if isinstance(finales.get(campo), str) else finales.get(campo)
        if (antes or None) != (despues or None):
            cambiados.append(campo)
    return cambiados


def campos_vacios_ia(intent: CampaignIntent) -> list[str]:
    propuestos = intent.campos_interpretados or {}
    return [c for c in CAMPOS if _vacio(propuestos.get(c))]


def revision_ms(intent: CampaignIntent) -> int | None:
    if intent.estado != IntentEstado.CONFIRMADO or not intent.confirmado_at:
        return None
    return max(int((intent.confirmado_at - intent.fecha_creacion).total_seconds() * 1000), 0)


def palabras(intent: CampaignIntent) -> int:
    return len((intent.transcripcion or "").split())


def _mediana(valores: list[int | float]) -> float | None:
    return round(median(valores), 1) if valores else None


def _promedio(valores: list[int | float]) -> float | None:
    return round(mean(valores), 2) if valores else None


def _resumen(intents: list[CampaignIntent]) -> dict:
    total = len(intents)
    confirmadas = [i for i in intents if i.estado == IntentEstado.CONFIRMADO]
    captura = [i.captura_ms for i in intents if i.captura_ms is not None]
    revision = [r for r in (revision_ms(i) for i in confirmadas) if r is not None]
    completo = [
        i.captura_ms + revision_ms(i)
        for i in confirmadas
        if i.captura_ms is not None and revision_ms(i) is not None
    ]
    por_campo = {campo: 0 for campo in CAMPOS}
    corregidos = []
    for intent in confirmadas:
        lista = campos_corregidos(intent)
        corregidos.append(len(lista))
        for campo in lista:
            por_campo[campo] += 1
    return {
        "intenciones": total,
        "confirmadas": len(confirmadas),
        "descartadas": sum(1 for i in intents if i.estado == IntentEstado.DESCARTADO),
        "abiertas": sum(1 for i in intents if i.estado == IntentEstado.BORRADOR),
        "tasa_finalizacion": round(len(confirmadas) / total, 3) if total else None,
        "captura_mediana_s": _mediana([ms / 1000 for ms in captura]),
        "captura_con_dato": len(captura),
        "revision_mediana_s": _mediana([ms / 1000 for ms in revision]),
        "total_mediana_s": _mediana([ms / 1000 for ms in completo]),
        "interpretacion_mediana_ms": _mediana([i.interpretacion_ms for i in intents if i.interpretacion_ms is not None]),
        "campos_corregidos_promedio": _promedio(corregidos),
        "correcciones_por_campo": por_campo if confirmadas else None,
        "campos_vacios_ia_promedio": _promedio([len(campos_vacios_ia(i)) for i in intents]),
        "palabras_mediana": _mediana([palabras(i) for i in intents]),
    }


def resumen(qs: QuerySet[CampaignIntent]) -> dict:
    """Las mismas métricas para voz y para formulario."""
    intents = list(qs.only(
        "origen", "estado", "transcripcion", "campos_interpretados", "campos_finales",
        "interpretacion_ms", "captura_ms", "fecha_creacion", "confirmado_at",
    ))
    return {
        "voz": _resumen([i for i in intents if i.origen == IntentOrigen.VOZ]),
        "formulario": _resumen([i for i in intents if i.origen == IntentOrigen.FORMULARIO]),
        "campos": CAMPOS,
    }


COLUMNAS_CSV = [
    "id", "origen", "estado", "fecha", "palabras", "captura_ms", "interpretacion_ms", "revision_ms",
    "campos_vacios_ia", "campos_corregidos", "lista_corregidos", "advertencias",
]


def csv_por_intencion(qs: QuerySet[CampaignIntent]) -> str:
    """Una fila por intención, sin texto del brief ni datos de la persona."""
    salida = io.StringIO()
    escritor = csv.writer(salida)
    escritor.writerow(COLUMNAS_CSV)
    for i in qs.order_by("fecha_creacion"):
        corregidos = campos_corregidos(i) if i.estado == IntentEstado.CONFIRMADO else []
        escritor.writerow([
            i.id,
            i.origen,
            i.estado,
            i.fecha_creacion.isoformat(),
            palabras(i),
            "" if i.captura_ms is None else i.captura_ms,
            "" if i.interpretacion_ms is None else i.interpretacion_ms,
            "" if revision_ms(i) is None else revision_ms(i),
            len(campos_vacios_ia(i)),
            len(corregidos) if i.estado == IntentEstado.CONFIRMADO else "",
            "|".join(corregidos),
            len(i.advertencias or []),
        ])
    return salida.getvalue()
