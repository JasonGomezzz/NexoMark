import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { ArrowLeft, CircleCheck, CircleX, ImageOff, AlertCircle, Loader2, Star } from 'lucide-react'
import ImageLightbox from '@/components/ui/ImageLightbox'
import { getCampaignById, approveCampaign, rejectCampaign } from '../services/clientCampaigns'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import RejectModal from '@/components/campaign/RejectModal'
import { useClientCampaignSocket } from '../hooks/useClientCampaignSocket'
import RedIcon from '@/components/social/RedIcon'
import XVariantReviewCard from '@/components/social/XVariantReviewCard'
import { estadoPublicacion, etiquetaRed } from '../services/social'

/**
 * Review de campaña del rol CLIENTE (HU14/HU15). Consume Spring Boot :8080
 * (camelCase: textoGenerado, imagenB64, clienteNombre, feedbackRechazo, version).
 * El cliente revisa el copy + imagen y APRUEBA o RECHAZA (feedback obligatorio).
 * El PATCH incluye `version` (optimistic locking @Version de JPA — Spring lo exige).
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

  // Ref (no state) para que handleStatusChanged no cambie de identidad en
  // cada toggle de `busy` y así no fuerce una reconexión del WebSocket.
  const busyRef = useRef(false)
  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  // Si otro usuario/pestaña resuelve esta misma campaña mientras la tenemos
  // abierta, reflejamos el nuevo estado (deshabilita Aprobar/Rechazar al
  // salir de pendiente_aprobacion) y avisamos — evita un PATCH con `version`
  // desactualizada. Si el cambio lo disparamos nosotros mismos (busyRef),
  // no mostramos el aviso: ya estamos navegando fuera con nuestro propio toast.
  const handleStatusChanged = useCallback(
    (updated) => {
      if (String(updated.id) !== String(id)) return
      setCampaign((current) => (current ? { ...current, ...updated } : current))
      if (!busyRef.current) setExternallyUpdated(true)
    },
    [id]
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
      toast.error('Selecciona una valoración de 1 a 5 estrellas.')
      return
    }
    setBusy(true)
    try {
      await approveCampaign(id, campaign.version, rating)
      toast.success('Campaña aprobada')
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo aprobar la campaña.')
      setBusy(false)
    }
  }

  async function handleReject(feedback) {
    if (!rating) {
      toast.error('Selecciona una valoración de 1 a 5 estrellas.')
      return
    }
    setBusy(true)
    try {
      await rejectCampaign(id, feedback, campaign.version, rating)
      setShowReject(false)
      toast.success('Campaña rechazada. El marketero recibirá tu feedback.')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo rechazar la campaña.')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex animate-pulse gap-6">
        <div className="h-96 flex-1 rounded-xl bg-surface-container-high" />
        <div className="hidden h-96 w-80 rounded-xl bg-surface-container-high lg:block" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
        <AlertCircle className="h-4 w-4" />
        No se pudo cargar la campaña. Verifica tu conexión o vuelve al inicio.
      </div>
    )
  }

  const puedeRevisar = campaign.estado === 'pendiente_aprobacion'

  return (
    <>
      <AppToaster />

      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </button>
          <h1 className="truncate text-2xl font-bold tracking-tight text-on-surface md:text-3xl">
            {campaign.titulo}
          </h1>
        </div>
        <StatusBadge estado={campaign.estado} className="px-4 py-1.5 text-sm" />
      </div>

      {/* Aviso si otro usuario/pestaña actualizó esta campaña en vivo */}
      {externallyUpdated && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-container px-4 py-3 text-sm font-medium text-warning">
          <AlertCircle className="h-4 w-4" />
          Esta campaña fue actualizada por otro usuario mientras la tenías abierta.
        </div>
      )}

      {/* Aviso si ya fue revisada */}
      {!puedeRevisar && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
            campaign.estado === 'aprobado'
              ? 'border-success/20 bg-success-container text-success'
              : campaign.estado === 'rechazado' || campaign.estado === 'fracaso'
                ? 'border-error/20 bg-error-container text-on-error-container'
                : 'border-outline-variant bg-surface-container-low text-on-surface-variant'
          }`}
        >
          {campaign.estado === 'aprobado'
            ? 'Ya aprobaste esta campaña.'
            : campaign.estado === 'rechazado'
              ? 'Ya rechazaste esta campaña. El marketero está trabajando en una nueva versión.'
              : campaign.estado === 'fracaso'
                ? 'Esta campaña fue rechazada dos veces y quedó cerrada como fracaso.'
              : 'Esta campaña aún no está lista para revisión.'}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Contenido: copy + imagen ── */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Copy propuesto
            </p>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-on-surface">
              {campaign.textoGenerado || 'Sin copy generado.'}
            </p>
          </div>

          <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Imagen del anuncio
            </p>
            {campaign.imagenB64 ? (
              <ImageLightbox
                src={`data:image/png;base64,${campaign.imagenB64}`}
                alt={`Imagen propuesta para ${campaign.titulo}`}
                downloadName={`campaign_${id}_imagen.png`}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-on-surface-variant">
                <ImageOff className="h-8 w-8 text-outline" />
                <p className="text-sm">Imagen no disponible</p>
              </div>
            )}
          </div>

          {/* X opcional: versión corta de la campaña aprobada, que el cliente aprueba aparte */}
          {campaign.estado === 'aprobado' && (
            <XVariantReviewCard campaignId={id} imagenB64={campaign.imagenB64} titulo={campaign.titulo} />
          )}

          {/* Feedback previo si la rechazó antes */}
          {['rechazado', 'fracaso'].includes(campaign.estado) && campaign.feedbackRechazo && (
            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-error">
                Tu feedback
              </p>
              <p className="text-sm leading-relaxed text-on-surface">{campaign.feedbackRechazo}</p>
            </div>
          )}

          {campaign.clienteValoracion && (
            <div className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Tu valoración
              </p>
              <StarRating value={campaign.clienteValoracion} readOnly />
            </div>
          )}
        </div>

        {/* ── Panel lateral: metadatos + acciones ── */}
        <div className="w-full shrink-0 space-y-4 lg:sticky lg:top-6 lg:w-80">
          <div className="space-y-3 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <MetaRow
              label="Marketero"
              value={campaign.marketeroNombre || (campaign.marketeroId ? `#${campaign.marketeroId}` : '—')}
            />
            <MetaRow label="Industria" value={campaign.industria} capitalize />
            <MetaRow label="Tono" value={campaign.tono} capitalize />
            <MetaRow label="Plataforma" value={campaign.plataforma} capitalize />
            {campaign.fechaCreacion && (
              <MetaRow
                label="Creada"
                value={new Date(campaign.fechaCreacion).toLocaleDateString('es-PE')}
              />
            )}
          </div>

          {campaign.destinos?.length > 0 && (
            <div className="space-y-2 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-on-surface">
                {puedeRevisar ? 'Al aprobar se publicará en' : 'Publicación'}
              </p>
              <ul className="space-y-2">
                {campaign.destinos.map((d) => (
                  <li key={`${d.red}-${d.cuentaNombre}`} className="flex items-center gap-2 text-sm">
                    <RedIcon red={d.red} className="h-5 w-5" />
                    <span className="font-medium text-on-surface">{d.cuentaNombre}</span>
                    <span className="text-xs text-on-surface-variant">{etiquetaRed(d.red)}</span>
                    {!puedeRevisar && (
                      d.permalink ? (
                        <a
                          href={d.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto text-xs font-semibold text-primary hover:underline"
                        >
                          Ver
                        </a>
                      ) : (
                        <span className="ml-auto text-xs text-on-surface-variant">
                          {estadoPublicacion(d.estado).texto}
                        </span>
                      )
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {puedeRevisar && (
            <div className="glass-soft space-y-3 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-on-surface">¿Qué decides?</p>
              <div className="rounded-lg border border-outline-variant bg-white/70 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Valoración
                </p>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <Button
                size="lg"
                className="w-full bg-success hover:bg-success/90"
                disabled={busy || !rating}
                onClick={handleApprove}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CircleCheck className="h-5 w-5" />
                )}
                {busy ? 'Procesando…' : 'Aprobar campaña'}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full border-error/30 text-error hover:bg-error-container/50"
                disabled={busy || !rating}
                onClick={() => setShowReject(true)}
              >
                <CircleX className="h-5 w-5" />
                Rechazar
              </Button>
              <p className="text-xs text-on-surface-variant">
                Si rechazas, deberás indicar el motivo para que el marketero pueda mejorarla.
              </p>
            </div>
          )}
        </div>
      </div>

      <RejectModal
        open={showReject}
        busy={busy}
        onCancel={() => setShowReject(false)}
        onConfirm={handleReject}
      />
    </>
  )
}

function StarRating({ value, onChange, readOnly = false }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            className={`rounded-md p-1 transition ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
            aria-label={`${star} estrella${star === 1 ? '' : 's'}`}
          >
            <Star className={`h-6 w-6 ${active ? 'fill-amber-400 text-amber-500' : 'text-outline'}`} />
          </button>
        )
      })}
      {value ? <span className="ml-2 text-sm font-semibold text-on-surface">{value}/5</span> : null}
    </div>
  )
}

function MetaRow({ label, value, capitalize }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className={`text-right text-on-surface ${capitalize ? 'capitalize' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}
