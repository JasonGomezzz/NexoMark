import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { AlertCircle, ArrowLeft, Check, CircleX, ImageOff, Loader2, Send, Star } from 'lucide-react'
import ImageLightbox from '@/components/ui/ImageLightbox'
import { getCampaignById, approveCampaign, rejectCampaign } from '../services/clientCampaigns'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import RejectModal from '@/components/campaign/RejectModal'
import SelloConforme from '@/components/SelloConforme'
import { useClientCampaignSocket } from '../hooks/useClientCampaignSocket'
import RedIcon from '@/components/social/RedIcon'
import XVariantReviewCard from '@/components/social/XVariantReviewCard'
import { estadoPublicacion, etiquetaRed } from '../services/social'
import { cn } from '@/lib/utils'

/**
 * Revisión del CLIENTE (estación Aprobar de la línea). Consume Spring Boot :8080
 * (camelCase: textoGenerado, imagenB64, clienteNombre, feedbackRechazo, version).
 * El cliente ve la pieza como saldrá publicada (cuenta, imagen y copy), la
 * califica y APRUEBA o RECHAZA (feedback obligatorio). El PATCH incluye
 * `version` (optimistic locking @Version de JPA — Spring lo exige) y la
 * valoración (Spring la pide en ambos casos).
 * Al aprobar, las dos piezas de la N encajan: es el segundo momento firma.
 */
export default function ClientReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rating, setRating] = useState(0)
  const [externallyUpdated, setExternallyUpdated] = useState(false)
  const [aprobada, setAprobada] = useState(false)

  // Ref (no state) para que handleStatusChanged no cambie de identidad en
  // cada toggle de `busy` y así no fuerce una reconexión del WebSocket.
  const busyRef = useRef(false)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  // Si otro usuario/pestaña resuelve esta misma campaña mientras la tenemos
  // abierta, reflejamos el nuevo estado y avisamos — evita un PATCH con
  // `version` desactualizada. Si el cambio lo disparamos nosotros (busyRef),
  // no mostramos el aviso.
  const handleStatusChanged = useCallback(
    (updated) => {
      if (String(updated.id) !== String(id)) return
      setCampaign((current) => (current ? { ...current, ...updated } : current))
      if (!busyRef.current) setExternallyUpdated(true)
    },
    [id],
  )

  const handleConnected = useCallback(() => setRevision((value) => value + 1), [setRevision])
  useClientCampaignSocket({ onCampaignStatusChanged: handleStatusChanged, onConnected: handleConnected })

  // Sin setState síncrono en el efecto: el estado inicial cubre el primer load.
  useEffect(() => {
    let cancelled = false
    getCampaignById(id)
      .then((c) => {
        if (!cancelled) setCampaign(c)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, revision])

  async function handleApprove() {
    if (!rating) {
      toast.error('Califica la pieza de 1 a 5 antes de decidir.')
      return
    }
    setBusy(true)
    try {
      await approveCampaign(id, campaign.version, rating)
      setAprobada(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo aprobar la campaña. Intenta de nuevo.')
      setBusy(false)
    }
  }

  async function handleReject(feedback) {
    if (!rating) {
      toast.error('Califica la pieza de 1 a 5 antes de decidir.')
      return
    }
    setBusy(true)
    try {
      await rejectCampaign(id, feedback, campaign.version, rating)
      setShowReject(false)
      toast.success('Rechazaste la campaña. El marketero recibe tu comentario.')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo rechazar la campaña. Intenta de nuevo.')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="grid animate-pulse gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="aspect-[4/5] max-w-xl rounded-[14px] bg-surface-container-high" />
        <div className="hidden h-80 rounded-[14px] bg-surface-container-high lg:block" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-[14px] border border-error/25 bg-error-container px-4 py-3 text-sm text-on-error-container">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        No se pudo cargar la campaña. Revisa tu conexión o vuelve al inicio.
      </div>
    )
  }

  const destinos = campaign.destinos ?? []
  const principal = destinos[0]

  if (aprobada) return <Aprobada campaign={campaign} destinos={destinos} onInicio={() => navigate('/dashboard')} />

  const puedeRevisar = campaign.estado === 'pendiente_aprobacion'

  return (
    <>
      <AppToaster />

      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="-ml-3 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Inicio
        </button>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="line-clamp-3 max-w-3xl text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em] text-on-surface sm:text-[36px]">
            {campaign.titulo}
          </h1>
          <StatusBadge estado={campaign.estado} className="px-4 py-1.5 text-sm" />
        </div>
        <p className="mt-2 text-[15px] text-on-surface-variant">
          De {campaign.marketeroNombre || 'tu agencia'}
          {campaign.fechaCreacion ? ` · creada el ${new Date(campaign.fechaCreacion).toLocaleDateString('es-PE')}` : ''}
        </p>
      </div>

      {externallyUpdated && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-[10px] bg-warning-container px-4 py-3 text-sm font-medium text-on-tertiary-container">
          <AlertCircle className="h-4 w-4 text-tertiary" aria-hidden="true" />
          Esta campaña cambió mientras la tenías abierta. Ya ves la versión nueva.
        </p>
      )}

      {!puedeRevisar && (
        <p
          className={cn(
            'mb-6 rounded-[10px] px-4 py-3 text-sm font-medium',
            campaign.estado === 'aprobado' && 'bg-success-container text-success',
            ['rechazado', 'fracaso'].includes(campaign.estado) && 'bg-error-container text-on-error-container',
            !['aprobado', 'rechazado', 'fracaso'].includes(campaign.estado) && 'bg-surface-container-low text-on-surface-variant',
          )}
        >
          {campaign.estado === 'aprobado'
            ? 'Ya aprobaste esta campaña.'
            : campaign.estado === 'rechazado'
              ? 'Ya la rechazaste. El marketero está preparando una nueva versión.'
              : campaign.estado === 'fracaso'
                ? 'Esta campaña se rechazó dos veces y quedó cerrada.'
                : 'Esta campaña todavía no está lista para revisar.'}
        </p>
      )}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
        {/* ── La pieza tal como saldrá publicada ── */}
        <section aria-labelledby="pieza-titulo" className="min-w-0">
          <h2 id="pieza-titulo" className="mb-1 text-2xl font-extrabold text-on-surface">
            {puedeRevisar ? 'Así se publicará' : 'La pieza'}
          </h2>
          <p className="mb-5 text-[15px] text-on-surface-variant">
            {puedeRevisar ? 'Lo que apruebes es exactamente lo que sale en tu cuenta.' : 'La versión que revisaste.'}
          </p>

          <article className="max-w-xl overflow-hidden rounded-[14px] border border-outline-variant bg-surface-container-lowest">
            <header className="flex items-center gap-3 px-4 py-3">
              {principal ? (
                <RedIcon red={principal.red} className="h-7 w-7" />
              ) : (
                <span aria-hidden="true" className="h-7 w-7 rounded-full bg-surface-container-high" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">{principal?.cuentaNombre || 'Sin cuenta de destino'}</p>
                <p className="text-[13px] text-on-surface-variant">{principal ? etiquetaRed(principal.red) : 'No se publicará automáticamente'}</p>
              </div>
            </header>
            {campaign.imagenB64 ? (
              <ImageLightbox
                src={`data:image/png;base64,${campaign.imagenB64}`}
                alt={`Imagen propuesta para ${campaign.titulo}`}
                downloadName={`campaign_${id}_imagen.png`}
                variante="post"
              />
            ) : (
              <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-surface-container-low text-on-surface-variant">
                <ImageOff className="h-8 w-8 text-outline" aria-hidden="true" />
                <p className="text-sm">Esta campaña no tiene imagen</p>
              </div>
            )}
            <p className="whitespace-pre-wrap px-4 py-4 text-[15px] leading-relaxed text-on-surface">
              {campaign.textoGenerado || 'Sin copy generado.'}
            </p>
          </article>

          {/* X opcional: versión corta de la campaña aprobada, que el cliente aprueba aparte */}
          {campaign.estado === 'aprobado' && (
            <div className="mt-10">
              <XVariantReviewCard campaignId={id} imagenB64={campaign.imagenB64} titulo={campaign.titulo} />
            </div>
          )}

          {['rechazado', 'fracaso'].includes(campaign.estado) && campaign.feedbackRechazo && (
            <div className="mt-8 max-w-xl border-t border-hairline pt-5">
              <p className="mb-2 text-sm font-semibold text-on-surface-variant">Tu comentario</p>
              <p className="text-[15px] leading-relaxed text-on-surface">«{campaign.feedbackRechazo}»</p>
            </div>
          )}
        </section>

        {/* ── La decisión ── */}
        <aside aria-label="Tu decisión" className="min-w-0 space-y-10">
          <section className="regla pt-5">
            <p className="mb-2 text-sm font-semibold text-on-surface-variant">{puedeRevisar ? 'Estación Aprobar' : 'Publicación'}</p>
            <h2 className="text-2xl font-extrabold leading-tight text-on-surface">
              {puedeRevisar ? (destinos.length ? 'Al aprobar, se publica en' : 'Al aprobar') : 'Dónde se publicó'}
            </h2>
            {destinos.length > 0 ? (
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
                {destinos.map((d) => (
                  <li key={`${d.red}-${d.cuentaNombre}`} className="flex min-h-12 items-center gap-3 py-2 text-sm">
                    <RedIcon red={d.red} className="h-6 w-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-on-surface">{d.cuentaNombre}</span>
                      <span className="block text-[13px] text-on-surface-variant">{etiquetaRed(d.red)}</span>
                    </span>
                    {!puedeRevisar &&
                      (d.permalink ? (
                        <a href={d.permalink} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
                          Ver publicación
                        </a>
                      ) : (
                        <span className="text-[13px] text-on-surface-variant">{estadoPublicacion(d.estado, d.red).texto}</span>
                      ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[15px] text-on-surface-variant">
                No hay cuentas de destino: la campaña queda aprobada y tu agencia la publica después.
              </p>
            )}
          </section>

          {puedeRevisar && (
            <section aria-labelledby="decide-titulo" className="border-t border-hairline pt-5">
              <h2 id="decide-titulo" className="font-display text-lg font-extrabold text-on-surface">
                Califica la pieza
              </h2>
              <p className="mb-3 text-[13px] text-on-surface-variant">Tu calificación llega a la agencia, apruebes o no.</p>
              <StarRating value={rating} onChange={setRating} />
              <div className="mt-6 grid gap-3">
                <Button size="lg" disabled={busy || !rating} onClick={handleApprove}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Check className="h-5 w-5" aria-hidden="true" />}
                  {busy ? 'Aprobando…' : destinos.length ? 'Aprobar y publicar' : 'Aprobar'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-error/40 text-error hover:border-error hover:bg-error-container hover:text-on-error-container"
                  disabled={busy || !rating}
                  onClick={() => setShowReject(true)}
                >
                  <CircleX className="h-5 w-5" aria-hidden="true" />
                  Pedir cambios
                </Button>
                <p className="text-[13px] text-on-surface-variant">
                  {rating ? 'Si pides cambios, cuéntale al marketero qué mejorar.' : 'Elige de 1 a 5 para habilitar tu decisión.'}
                </p>
              </div>
            </section>
          )}

          {!puedeRevisar && campaign.clienteValoracion && (
            <section className="border-t border-hairline pt-5">
              <p className="mb-2 text-sm font-semibold text-on-surface-variant">Tu calificación</p>
              <StarRating value={campaign.clienteValoracion} readOnly />
            </section>
          )}
        </aside>
      </div>

      <RejectModal open={showReject} busy={busy} onCancel={() => setShowReject(false)} onConfirm={handleReject} />
    </>
  )
}

/**
 * Momento firma: la aprobación. El sello «conforme» cae sobre la pieza y las
 * dos piezas de la N encajan dentro (quien crea y quien aprueba). Con "reducir movimiento"
 * aparece directamente encajada.
 */
function Aprobada({ campaign, destinos, onInicio }) {
  const cuenta = destinos[0]
  return (
    <section role="status" aria-live="polite" className="mx-auto max-w-2xl py-8 sm:py-14">
      <div className="flex items-center gap-5">
        <span className="relative shrink-0">
          {campaign.imagenB64 ? (
            <img src={`data:image/png;base64,${campaign.imagenB64}`} alt="" className="h-28 w-28 rounded-[12px] object-cover" />
          ) : (
            <span className="block h-28 w-28 rounded-[12px] bg-surface-container-high" />
          )}
          <SelloConforme estampar retraso={0.1} tamano={76} className="absolute -bottom-5 -right-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">Conforme</p>
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">
            Lo aprobado es lo publicado
          </h1>
        </div>
      </div>
      <motion.p
        initial={{ opacity: 0, transform: 'translateY(6px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)' }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.35 }}
        className="mt-6 text-[17px] leading-relaxed text-on-surface-variant"
      >
        Aprobaste «{campaign.titulo}».{' '}
        {cuenta
          ? `Ahora se publica en ${cuenta.cuentaNombre} (${etiquetaRed(cuenta.red)})${destinos.length > 1 ? ` y ${destinos.length - 1} cuenta${destinos.length > 2 ? 's' : ''} más` : ''}, tal cual la viste.`
          : 'Tu agencia la publicará; no tiene cuentas de destino.'}
      </motion.p>

      <ol className="mt-12 flex flex-wrap items-center gap-3" aria-label="Orden de trabajo">
        {[
          { label: 'Aprobar', hecha: true },
          { label: 'Publicar', actual: true },
          { label: 'Medir' },
        ].map(({ label, hecha, actual }, i) => (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden="true" className={cn('h-px w-8', hecha || actual ? 'bg-primary' : 'bg-outline-variant')} />}
            <span className={cn('casilla h-10 w-10', hecha && 'border-0 bg-primary-fixed text-primary', actual && 'casilla-actual', !hecha && !actual && 'casilla-pliego')} aria-hidden="true">
              {hecha && <Check className="h-4 w-4" strokeWidth={2.75} />}
              {actual && <Send className="h-[18px] w-[18px]" strokeWidth={2.25} />}
            </span>
            <span className={cn('font-display text-[15px]', actual ? 'font-extrabold text-on-surface' : 'font-semibold text-on-surface-variant')}>
              {label}
              <span className="sr-only">{hecha ? ': hecho' : actual ? ': en curso' : ': pendiente'}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" onClick={onInicio}>
          Volver al inicio
        </Button>
      </div>
    </section>
  )
}

/** Calificación de 1 a 5 como grupo de opciones (teclado: flechas; 44 px por estrella). */
function StarRating({ value, onChange, readOnly = false }) {
  if (readOnly) {
    return (
      <p className="flex items-center gap-1" aria-label={`${value} de 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} aria-hidden="true" className={`h-6 w-6 ${star <= value ? 'fill-tertiary text-tertiary' : 'text-outline'}`} />
        ))}
        <span className="ml-2 text-sm font-semibold text-on-surface">{value}/5</span>
      </p>
    )
  }
  const mover = (event, star) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(Math.min(5, star + 1))
      event.currentTarget.nextElementSibling?.focus()
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(Math.max(1, star - 1))
      event.currentTarget.previousElementSibling?.focus()
    }
  }
  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label="Calificación de la pieza" className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const activa = star <= value
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} de 5`}
              tabIndex={value ? (value === star ? 0 : -1) : star === 1 ? 0 : -1}
              onClick={() => onChange(star)}
              onKeyDown={(e) => mover(e, star)}
              className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-surface-container-low"
            >
              <Star aria-hidden="true" className={`h-7 w-7 ${activa ? 'fill-tertiary text-tertiary' : 'text-outline'}`} />
            </button>
          )
        })}
      </div>
      {value ? <span className="ml-2 text-sm font-semibold tabular-nums text-on-surface">{value}/5</span> : null}
    </div>
  )
}
