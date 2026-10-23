import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, CircleCheck, ExternalLink, ImageOff, Send, X } from 'lucide-react'
import RedIcon from './RedIcon'
import PublicationBadge from './PublicationBadge'
import { etiquetaRed, formatoMetrica, haceCuanto, metricasDeRed } from '../../services/social'
import { socialApi } from '../../services/socialApi'

const FECHA = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }

function fecha(iso) {
  return iso ? new Date(iso).toLocaleString('es-PE', FECHA) : null
}

/**
 * Estadísticas de una publicación: lo que se publicó, la cadena aprobada → publicada →
 * medida y las métricas. Al abrir pide a Django que refresque desde Meta (el servidor
 * respeta un intervalo mínimo de 10 minutos).
 */
export default function PublicationStatsDrawer({ publicacionId, onClose, onActualizada }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const cerrar = useRef(null)
  const panel = useRef(null)

  useEffect(() => {
    let vigente = true
    socialApi
      .estadisticas(publicacionId)
      .then((d) => {
        if (!vigente) return
        setDatos(d)
        onActualizada?.(d.publicacion)
      })
      .catch((err) => vigente && setError(err.response?.status === 404 ? 'No encontramos esta publicación.' : 'No se pudieron cargar las estadísticas.'))
    return () => {
      vigente = false
    }
    // onActualizada cambia en cada render del padre; solo importa el id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicacionId])

  useEffect(() => {
    // Al cerrar, el foco vuelve a la fila o botón que abrió el detalle.
    const origen = document.activeElement
    cerrar.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') mantenerFocoDentro(e, panel.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (origen instanceof HTMLElement) origen.focus()
    }
  }, [onClose])

  const p = datos?.publicacion
  const metrica = p?.ultima_metrica
  const { principales, secundarias, sinLectura, motivoSinLectura } = metricasDeRed(p?.red)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-on-surface/40 backdrop-blur-sm" onClick={onClose}>
      <motion.aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-publicacion-titulo"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-surface-container-lowest shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant/60 px-6 py-5">
          {p ? (
            <div className="flex min-w-0 items-center gap-3">
              <RedIcon red={p.red} className="h-9 w-9" />
              <div className="min-w-0">
                <h2 id="detalle-publicacion-titulo" className="truncate text-lg font-semibold text-on-surface">
                  {p.campaign_titulo}
                </h2>
                <p className="truncate text-sm text-on-surface-variant">
                  {p.cuenta_nombre} · {etiquetaRed(p.red)}
                </p>
              </div>
            </div>
          ) : (
            <h2 id="detalle-publicacion-titulo" className="text-lg font-semibold text-on-surface">
              Estadísticas de la publicación
            </h2>
          )}
          <button
            ref={cerrar}
            onClick={onClose}
            aria-label="Cerrar estadísticas"
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {!p && !error && <Esqueleto />}

          {p && (
            <div className="space-y-8">
              <Cadena publicacion={p} metrica={metrica} lecturas={datos.historial.length} />

              <section aria-labelledby="metricas-titulo">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 id="metricas-titulo" className="font-semibold text-on-surface">
                    Métricas
                  </h3>
                  {metrica && (
                    <span className="text-xs text-on-surface-variant">Leídas {haceCuanto(metrica.obtenida_at)}</span>
                  )}
                </div>
                {datos.aviso && !sinLectura && (
                  <p className="mt-2 text-sm text-on-surface-variant">{datos.aviso}</p>
                )}
                {metrica ? (
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                    {[...principales, ...secundarias].map(([campo, etiqueta]) => {
                      const valor = metrica[campo]
                      const sinDato = valor === null || valor === undefined
                      return (
                        <div key={campo}>
                          <dt className="text-sm text-on-surface-variant">{etiqueta}</dt>
                          <dd
                            className={
                              sinDato
                                ? 'mt-1 text-sm font-medium leading-8 text-on-surface-variant'
                                : 'mt-1 text-2xl font-bold tabular-nums text-on-surface'
                            }
                          >
                            {formatoMetrica(valor)}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-on-surface-variant">
                    {sinLectura
                      ? motivoSinLectura
                      : p.estado === 'publicado'
                        ? 'Meta todavía no entrega métricas de esta publicación; pueden tardar hasta 48 horas.'
                        : 'Las métricas aparecen cuando la publicación ya está en la red social.'}
                  </p>
                )}
              </section>

              {datos.historial.length > 1 && <Historial historial={datos.historial} red={p.red} />}

              <section aria-labelledby="publicado-titulo">
                <h3 id="publicado-titulo" className="font-semibold text-on-surface">
                  {p.estado === 'publicado' ? 'Lo que se publicó' : 'Lo que aprobó el cliente'}
                </h3>
                {p.imagen_url || p.copy_aprobado ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={`Imagen aprobada de ${p.campaign_titulo}`} className="w-full" />
                    ) : (
                      <p className="flex items-center gap-2 px-4 pt-4 text-sm text-on-surface-variant">
                        <ImageOff className="h-4 w-4" />
                        Sin imagen aprobada.
                      </p>
                    )}
                    {p.copy_aprobado && (
                      <p className="whitespace-pre-line px-4 py-4 text-sm leading-relaxed text-on-surface">
                        {p.copy_aprobado}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-on-surface-variant">
                    El texto y la imagen se congelan cuando el cliente aprueba: eso es exactamente lo que se publica.
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      </motion.aside>
    </div>
  )
}

/** Aprobada → publicada → medida: cada número nace de una versión que el cliente aprobó. */
function Cadena({ publicacion: p, metrica, lecturas }) {
  const publicada = p.estado === 'publicado'
  const tiktok = p.red === 'tiktok'
  const enBuzon = tiktok && p.estado === 'en_buzon'
  const pasos = [
    {
      hecho: p.version_aprobada != null,
      titulo: 'Aprobada por el cliente',
      detalle: p.version_aprobada != null ? `Versión ${p.version_aprobada} de la campaña` : 'Esperando la aprobación',
    },
    {
      hecho: publicada || enBuzon,
      error: p.estado === 'fallido',
      titulo: publicada
        ? `Publicada en ${p.cuenta_nombre}`
        : enBuzon
          ? `En el buzón de ${p.cuenta_nombre}`
          : tiktok
            ? 'Envío a TikTok'
            : 'Publicación',
      detalle: publicada
        ? fecha(p.publicado_at)
        : enBuzon
          ? 'Falta publicarla desde la app de TikTok.'
          : p.error || null,
      badge: !publicada && !enBuzon,
      enlace: publicada && p.permalink,
    },
    {
      hecho: Boolean(metrica),
      titulo: tiktok ? 'Medida en TikTok' : 'Medida en Meta',
      detalle: metrica
        ? `${lecturas === 1 ? '1 lectura' : `${lecturas} lecturas`}, la última ${haceCuanto(metrica.obtenida_at)}`
        : tiktok
          ? 'Sin dato: TikTok no entrega métricas con los permisos actuales.'
          : 'Sin lecturas todavía',
    },
  ]

  return (
    <ol className="relative space-y-5">
      {pasos.map((paso, i) => (
        <li key={paso.titulo} className="relative flex gap-4">
          {i < pasos.length - 1 && (
            <span
              aria-hidden="true"
              className={`absolute top-8 left-[13px] h-[calc(100%-12px)] w-0.5 ${
                paso.hecho ? 'bg-success' : 'bg-outline-variant'
              }`}
            />
          )}
          <span
            aria-hidden="true"
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              paso.error
                ? 'bg-error text-on-error'
                : paso.hecho
                  ? 'bg-success text-on-success'
                  : 'bg-surface-container-high text-outline'
            }`}
          >
            {paso.error ? (
              <AlertCircle className="h-4 w-4" />
            ) : i === 1 && paso.hecho ? (
              <Send className="h-3.5 w-3.5" />
            ) : (
              <CircleCheck className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-on-surface">{paso.titulo}</p>
              {paso.badge && <PublicationBadge estado={p.estado} red={p.red} />}
            </div>
            {paso.detalle && (
              <p className={`mt-0.5 text-sm ${paso.error ? 'text-error' : 'text-on-surface-variant'}`}>
                {paso.detalle}
              </p>
            )}
            {paso.enlace && (
              <a
                href={paso.enlace}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver en {etiquetaRed(p.red)}
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Historial({ historial, red }) {
  const [principal, comentarios] = metricasDeRed(red).principales
  return (
    <section aria-labelledby="historial-titulo">
      <h3 id="historial-titulo" className="font-semibold text-on-surface">
        Historial de lecturas
      </h3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low text-left text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            <tr>
              <th className="px-4 py-2.5">Lectura</th>
              <th className="px-4 py-2.5 text-right">{principal[1]}</th>
              <th className="px-4 py-2.5 text-right">{comentarios[1]}</th>
              <th className="px-4 py-2.5 text-right">Alcance</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((m) => (
              <tr key={m.obtenida_at} className="border-t border-outline-variant/40">
                <td className="px-4 py-2.5 whitespace-nowrap text-on-surface-variant">{fecha(m.obtenida_at)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatoMetrica(m.me_gusta)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatoMetrica(m.comentarios)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatoMetrica(m.alcance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Esqueleto() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-7 w-7 animate-pulse rounded-full bg-surface-container-high" />
          <div className="h-10 flex-1 animate-pulse rounded bg-surface-container-high" />
        </div>
      ))}
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-surface-container-high" />
        ))}
      </div>
      <div className="aspect-video animate-pulse rounded-2xl bg-surface-container-high" />
    </div>
  )
}

/** Tab y Shift+Tab recorren solo los controles del panel mientras está abierto. */
function mantenerFocoDentro(e, contenedor) {
  if (!contenedor) return
  const focuseables = contenedor.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  if (!focuseables.length) return
  const primero = focuseables[0]
  const ultimo = focuseables[focuseables.length - 1]
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault()
    ultimo.focus()
  } else if (!e.shiftKey && (document.activeElement === ultimo || !contenedor.contains(document.activeElement))) {
    e.preventDefault()
    primero.focus()
  }
}
