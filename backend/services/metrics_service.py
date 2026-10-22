"""
MarketMind Voice — Estadísticas de publicaciones (Fase 4).

- refrescar_metricas: pide a Meta las métricas de una publicación y guarda una
  foto (PublicationMetric). Respeta un intervalo mínimo para no gastar el
  límite de llamadas de la API.
- resumen_por_red: lo que muestra el dashboard: publicaciones por red,
  totales de la última foto de cada una y serie mensual. Con `anio`, todo se
  limita a las publicaciones de ese año (por fecha de publicación o, si no
  llegó a publicarse, de creación).
- serie_anual: los 12 meses de un año por red: publicaciones (conteo propio,
  0 es real) y me gusta (suma de la última foto; None si ninguna tiene dato).

Un dato que Meta no entrega es None; los totales lo ignoran y si ninguna
publicación tiene el dato, el total también es None.
"""

from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Prefetch, QuerySet
from django.db.models.functions import Coalesce, ExtractYear, TruncMonth
from django.utils import timezone

from apps.social.models import (
    ConexionEstado,
    PublicacionEstado,
    Publication,
    PublicationMetric,
    RedSocial,
)
from services import meta_graph
from services.social_tokens import TokenIlegible, descifrar

INTERVALO_MINIMO = timedelta(minutes=10)
CAMPOS = ["me_gusta", "comentarios", "compartidos", "guardados", "alcance", "vistas", "interacciones"]
MESES_SERIE = 6


class MetricasNoDisponibles(Exception):
    pass


def ultima_metrica(publicacion: Publication) -> PublicationMetric | None:
    return publicacion.metricas.order_by("-obtenida_at").first()


def refrescar_metricas(publicacion: Publication, forzar: bool = False) -> PublicationMetric:
    """Devuelve la foto más reciente; consulta a Meta solo si la última es vieja."""
    if publicacion.red == RedSocial.X:
        # Leer posts en la API de X cuesta (pago por uso): en esta entrega no se consulta.
        raise MetricasNoDisponibles("Las métricas de X no se leen para no generar costo")
    if publicacion.red == RedSocial.TIKTOK:
        # Con user.info.basic y video.upload TikTok no entrega métricas de las publicaciones.
        raise MetricasNoDisponibles("TikTok no entrega métricas con los permisos actuales")
    if publicacion.estado != PublicacionEstado.PUBLICADO:
        raise MetricasNoDisponibles("La publicación todavía no está en la red social.")
    if not publicacion.externo_id:
        raise MetricasNoDisponibles(
            "Meta confirmó la publicación, pero no se pudo identificar el post: no hay estadísticas."
        )

    ultima = ultima_metrica(publicacion)
    if ultima and not forzar and timezone.now() - ultima.obtenida_at < INTERVALO_MINIMO:
        return ultima

    conexion = publicacion.conexion
    if conexion is None or conexion.estado != ConexionEstado.ACTIVA:
        raise MetricasNoDisponibles("La cuenta fue desconectada; vuelve a conectarla para ver estadísticas.")
    try:
        token = descifrar(conexion.token_cifrado)
        if publicacion.red == RedSocial.INSTAGRAM:
            datos = meta_graph.metricas_instagram(publicacion.externo_id, token)
        else:
            datos = meta_graph.metricas_facebook(publicacion.externo_id, token)
    except (meta_graph.MetaError, TokenIlegible) as exc:
        if ultima:
            return ultima
        raise MetricasNoDisponibles(str(exc)) from exc

    return PublicationMetric.objects.create(
        publicacion=publicacion,
        crudo=datos.pop("crudo", {}),
        **{campo: _entero(datos.get(campo)) for campo in CAMPOS},
    )


def _entero(valor) -> int | None:
    try:
        return None if valor is None else int(valor)
    except (TypeError, ValueError):
        return None


def con_ultima_metrica(qs: QuerySet[Publication]) -> QuerySet[Publication]:
    """Precarga las fotos ordenadas para leer la última sin una consulta por publicación."""
    return qs.prefetch_related(
        Prefetch("metricas", queryset=PublicationMetric.objects.order_by("-obtenida_at"), to_attr="metricas_ordenadas")
    )


def _sumar(valores: list[int | None]) -> int | None:
    presentes = [v for v in valores if v is not None]
    return sum(presentes) if presentes else None


def refrescar_recientes(qs: QuerySet[Publication], limite: int = 20) -> dict:
    """Actualiza las publicaciones publicadas más recientes del alcance del usuario."""
    actualizadas, sin_datos = 0, 0
    recientes = qs.filter(estado=PublicacionEstado.PUBLICADO).select_related("conexion").order_by("-publicado_at")
    for publicacion in recientes[:limite]:
        try:
            refrescar_metricas(publicacion)
            actualizadas += 1
        except MetricasNoDisponibles:
            sin_datos += 1
    return {"actualizadas": actualizadas, "sin_datos": sin_datos}


def con_fecha_referencia(qs: QuerySet[Publication]) -> QuerySet[Publication]:
    """fecha_ref: cuándo se publicó o, si todavía no (pendiente, fallida), cuándo se programó."""
    return qs.annotate(fecha_ref=Coalesce("publicado_at", "fecha_creacion"))


def del_anio(qs: QuerySet[Publication], anio: int) -> QuerySet[Publication]:
    """Publicaciones cuyo año (hora de Lima) es `anio`."""
    return con_fecha_referencia(qs).filter(fecha_ref__year=anio)


def anios_con_publicaciones(qs: QuerySet[Publication]) -> list[int]:
    """Años con alguna publicación, del más reciente al más antiguo; siempre incluye el actual."""
    anios = set(
        con_fecha_referencia(qs)
        .annotate(anio=ExtractYear("fecha_ref"))
        .order_by()
        .values_list("anio", flat=True)
        .distinct()
    )
    anios.add(timezone.localtime().year)
    return sorted(anios, reverse=True)


def serie_anual(qs: QuerySet[Publication], anio: int) -> dict:
    """
    Los 12 meses de `anio` por red, según la fecha de publicación.

    - publicaciones_por_mes: cuántas se publicaron (0 es un dato real).
    - me_gusta_por_mes: suma de la última foto de cada publicación del mes, con
      cuántas tenían el dato. None si ninguna lo tenía: no es cero.
    """
    redes = RedSocial.values
    publicaciones = [{"mes": f"{anio}-{m:02d}", **{red: 0 for red in redes}} for m in range(1, 13)]
    me_gusta = [
        {
            "mes": f"{anio}-{m:02d}",
            **{red: None for red in redes},
            **{f"{red}_con_dato": 0 for red in redes},
            **{f"{red}_publicaciones": 0 for red in redes},
        }
        for m in range(1, 13)
    ]
    publicadas = con_ultima_metrica(del_anio(qs, anio).filter(estado=PublicacionEstado.PUBLICADO))
    for publicacion in publicadas:
        red = publicacion.red
        if red not in redes:
            continue
        i = timezone.localtime(publicacion.fecha_ref).month - 1
        publicaciones[i][red] += 1
        fila = me_gusta[i]
        fila[f"{red}_publicaciones"] += 1
        ultima = publicacion.metricas_ordenadas[0] if publicacion.metricas_ordenadas else None
        if ultima is not None and ultima.me_gusta is not None:
            fila[red] = (fila[red] or 0) + ultima.me_gusta
            fila[f"{red}_con_dato"] += 1

    return {
        "anio": anio,
        "anios": anios_con_publicaciones(qs),
        "publicaciones_por_mes": publicaciones,
        "me_gusta_por_mes": me_gusta,
    }


def resumen_por_red(qs: QuerySet[Publication], anio: int | None = None) -> dict:
    """
    Totales por red para el dashboard, usando la última foto de cada publicación.

    Sin `anio` (app Android) los totales son de todo el historial, como antes.
    `anual` siempre viene: los 12 meses del año pedido o del actual.
    """
    todas = qs
    if anio is not None:
        qs = del_anio(qs, anio)
    publicadas = con_ultima_metrica(qs.filter(estado=PublicacionEstado.PUBLICADO))
    # Mes calendario de Lima, no de UTC: el 1 a las 20:00 de Lima ya es día 2 en UTC.
    inicio_mes = timezone.localtime().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    redes = {}
    por_red: dict[str, list[Publication]] = defaultdict(list)
    for publicacion in publicadas:
        por_red[publicacion.red].append(publicacion)

    for red in RedSocial.values:
        lista = por_red.get(red, [])
        ultimas = [p.metricas_ordenadas[0] for p in lista if p.metricas_ordenadas]
        redes[red] = {
            "publicaciones": len(lista),
            "publicaciones_mes": sum(1 for p in lista if p.publicado_at and p.publicado_at >= inicio_mes),
            "con_metricas": len(ultimas),
            "metricas_al": max((m.obtenida_at for m in ultimas), default=None),
            **{campo: _sumar([getattr(m, campo) for m in ultimas]) for campo in CAMPOS},
        }

    desde = (inicio_mes - timedelta(days=31 * (MESES_SERIE - 1))).replace(day=1)
    serie = (
        qs.filter(estado=PublicacionEstado.PUBLICADO, publicado_at__gte=desde)
        .annotate(mes=TruncMonth("publicado_at"))
        .values("mes", "red")
        .annotate(total=Count("id"))
        .order_by("mes")
    )
    meses: dict[str, dict] = {}
    for fila in serie:
        clave = fila["mes"].strftime("%Y-%m")
        meses.setdefault(clave, {"mes": clave, **{red: 0 for red in RedSocial.values}})[fila["red"]] = fila["total"]

    return {
        "redes": redes,
        "por_mes": sorted(meses.values(), key=lambda m: m["mes"]),
        "total_publicaciones": sum(r["publicaciones"] for r in redes.values()),
        "fallidas": qs.filter(estado=PublicacionEstado.FALLIDO).count(),
        "pendientes": qs.filter(estado=PublicacionEstado.ESPERANDO_APROBACION).count(),
        "anual": serie_anual(todas, anio if anio is not None else timezone.localtime().year),
    }
