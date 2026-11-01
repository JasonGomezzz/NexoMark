import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import { History, X, ImageOff, GitCompareArrows, RotateCcw } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Historial de versiones (HU23) como drawer lateral — portado de Stitch
 * "comparativa lateral". Cada generación guarda copy + imagen (LRU-5).
 * GET /api/campaigns/{id}/versions/ → [{id, version_number, texto_preview,
 * tiene_imagen, imagen_b64, created_at}] (más reciente primero).
 * Restaurar: POST /versions/{vid}/restore/ — solo si `canRestore`
 * (estado editable); guarda snapshot del contenido actual antes de copiar.
 */
export default function VersionHistoryPanel({
  campaignId,
  canRestore = false,
  onRestored,
  onVersiones,
  refreshKey = 0,
}) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [compareId, setCompareId] = useState(null)
  const [restoringId, setRestoringId] = useState(null)

  // Solo setea estado en callbacks async (.then/.catch/.finally) — apto para
  // llamarse desde el efecto sin setState síncrono.
  function fetchVersions() {
    return api
      .get(`/api/campaigns/${campaignId}/versions/`)
      .then(({ data }) => {
        setVersions(data.data ?? [])
        onVersiones?.(data.data ?? [])
        setError(false)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, refreshKey])

  async function handleRestore(version) {
    setRestoringId(version.id)
    try {
      const { data } = await api.post(
        `/api/campaigns/${campaignId}/versions/${version.id}/restore/`,
      )
      toast.success(data.message || 'Versión restaurada')
      setCompareId(null)
      onRestored?.(data.data.campaign)
      await fetchVersions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo restaurar la versión')
    } finally {
      setRestoringId(null)
    }
  }

  // Cierre con Esc (accesibilidad)
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const actual = versions[0] ?? null
  const compared = versions.find((v) => v.id === compareId) ?? null

  return (
    <>
      {/* Trigger en la columna de metadatos del detalle */}
      <div className="regla pt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-on-surface-variant">
            Historial de versiones
          </p>
          <History className="h-4 w-4 text-outline" />
        </div>
        {loading ? (
          <div className="h-8 animate-pulse rounded bg-surface-container-high" />
        ) : error ? (
          <p className="text-[13px] text-error">No se pudo cargar el historial.</p>
        ) : versions.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">
            Aún no hay versiones. Se guardan desde la primera generación.
          </p>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
            Ver {versions.length} {versions.length === 1 ? 'versión' : 'versiones'}
          </Button>
        )}
      </div>

      {/* Drawer lateral */}
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-navy-deep/60"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Historial de versiones"
          >
            <motion.aside
              initial={{ transform: 'translateX(100%)' }}
              animate={{ transform: 'translateX(0%)' }}
              exit={{ transform: 'translateX(100%)' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'flex h-full w-full flex-col overflow-hidden border-l border-outline-variant bg-background shadow-2xl',
                compared ? 'max-w-3xl' : 'max-w-md',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del drawer */}
              <div className="flex items-start justify-between border-b border-outline-variant/60 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">Historial de versiones</h3>
                  <p className="text-[13px] text-on-surface-variant">
                    Se guardan las últimas 5 versiones generadas desde la primera creación.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar historial"
                  className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {compared && actual ? (
                  <CompareView
                    left={actual}
                    right={compared}
                    onClose={() => setCompareId(null)}
                    onRestore={canRestore ? () => handleRestore(compared) : null}
                    restoring={restoringId === compared.id}
                  />
                ) : (
                  <ul className="divide-y divide-hairline border-y border-hairline">
                    {versions.map((v, i) => (
                      <li
                        key={v.id}
                        className="flex gap-4 py-4"
                      >
                        <VersionThumb version={v} size="h-20 w-20" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-bold text-on-surface">
                              Versión {v.version_number}
                            </span>
                            {i === 0 && (
                              <span className="rounded-[6px] bg-primary-fixed px-2 py-0.5 text-[13px] font-bold text-on-primary-fixed">
                                Actual
                              </span>
                            )}
                          </div>
                          <p className="mb-2 text-[13px] text-on-surface-variant">
                            {relativeDate(v.created_at)}
                          </p>
                          <p className="line-clamp-2 text-[13px] leading-relaxed text-on-surface-variant">
                            {v.texto_preview}
                          </p>
                          {i > 0 && (
                            <div className="mt-2 flex flex-wrap gap-3">
                              <button
                                onClick={() => setCompareId(v.id)}
                                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
                              >
                                <GitCompareArrows className="h-3.5 w-3.5" />
                                Comparar con la actual
                              </button>
                              {canRestore && (
                                <button
                                  onClick={() => handleRestore(v)}
                                  disabled={restoringId !== null}
                                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-on-surface-variant transition-colors hover:text-primary hover:underline disabled:opacity-50"
                                >
                                  <RotateCcw
                                    className={`h-3.5 w-3.5 ${restoringId === v.id ? 'animate-spin' : ''}`}
                                  />
                                  {restoringId === v.id ? 'Restaurando…' : 'Restaurar'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Comparación lado a lado: versión actual vs seleccionada, con diff resaltado. */
function CompareView({ left, right, onClose, onRestore, restoring }) {
  const [wordsL, wordsR] = useMemo(
    () => diffWords(left.texto_preview ?? '', right.texto_preview ?? ''),
    [left, right],
  )

  const cols = [
    { v: left, words: wordsL, label: `Versión ${left.version_number} (Actual)`, accent: true },
    { v: right, words: wordsR, label: `Versión ${right.version_number}`, accent: false },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          Modo comparar
        </p>
        <div className="flex gap-2">
          {onRestore && (
            <Button variant="outline" size="sm" onClick={onRestore} disabled={restoring}>
              <RotateCcw className={`h-3.5 w-3.5 ${restoring ? 'animate-spin' : ''}`} />
              {restoring ? 'Restaurando…' : 'Restaurar esta versión'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Volver a la lista
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cols.map(({ v, words, label, accent }) => (
          <div key={v.id} className="min-w-0">
            <p
              className={cn(
                'mb-2 border-b-2 pb-2 text-sm font-bold',
                accent ? 'border-primary text-primary' : 'border-outline-variant text-on-surface',
              )}
            >
              {label}
              <span className="ml-2 font-normal text-on-surface-variant">
                {relativeDate(v.created_at)}
              </span>
            </p>
            <VersionThumb version={v} size="h-36 w-full" className="mb-3" />
            <div className="border-t border-hairline pt-3 text-[13px] leading-relaxed text-on-surface">
              <p className="mb-1 text-[13px] font-bold text-on-surface-variant">
                Copy del anuncio
              </p>
              <p className="whitespace-pre-wrap">
                {words.map((w, i) =>
                  w.changed ? (
                    <mark
                      key={i}
                      className={cn(
                        'rounded px-0.5',
                        accent
                          ? 'bg-success-container text-success'
                          : 'bg-error-container text-error line-through',
                      )}
                    >
                      {w.text}
                    </mark>
                  ) : (
                    <span key={i}>{w.text}</span>
                  ),
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VersionThumb({ version, size, className }) {
  return version.tiene_imagen && version.imagen_b64 ? (
    <img
      src={`data:image/png;base64,${version.imagen_b64}`}
      alt={`Imagen de la versión ${version.version_number}`}
      className={cn('shrink-0 rounded-lg object-cover', size, className)}
    />
  ) : (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-outline',
        size,
        className,
      )}
    >
      <ImageOff className="h-6 w-6" />
    </div>
  )
}

/**
 * Diff simple por palabras: marca en cada lado las palabras que el otro no tiene.
 * Sin librerías; el texto de IA pasa por escapado JSX normal (nunca HTML crudo).
 */
function diffWords(textA, textB) {
  const tokenize = (t) => t.split(/(\s+)/)
  const setOf = (t) => new Set(t.toLowerCase().split(/\s+/).filter(Boolean))
  const setA = setOf(textA)
  const setB = setOf(textB)
  const mark = (tokens, other) =>
    tokens.map((text) => ({
      text,
      changed: /\S/.test(text) && !other.has(text.toLowerCase().trim()),
    }))
  return [mark(tokenize(textA), setB), mark(tokenize(textB), setA)]
}

/** Fecha relativa en español: "hace 2 min", "hace 3 h", "hace 2 días". */
function relativeDate(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  return new Date(iso).toLocaleDateString('es-PE')
}
