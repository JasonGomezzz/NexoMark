import { useCallback, useEffect, useRef, useState } from 'react'
import PublicationsPanel from '@/components/social/PublicationsPanel'
import XVariantPanel from '@/components/social/XVariantPanel'
import RedIcon from '@/components/social/RedIcon'
import { socialApi } from '../services/socialApi'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { ArrowLeft, FileText, ImageOff, RefreshCw, Send, Star, Trash2 } from 'lucide-react'
import ImageLightbox from '@/components/ui/ImageLightbox'
import api from '../services/api'
import VersionHistoryPanel from '../components/VersionHistoryPanel'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import CampaignStepper from '@/components/CampaignStepper'

// El backend solo acepta cambios de contenido en borrador, generado o rechazado.
const READONLY_STATES = ['pendiente_aprobacion', 'aprobado', 'fracaso']
const READONLY_MESSAGES = {
  pendiente_aprobacion: 'El cliente está revisando esta campaña. No se puede editar hasta que decida.',
  aprobado: 'Esta campaña fue aprobada. El texto está bloqueado.',
  fracaso: 'Esta campaña fue rechazada dos veces y quedó en fracaso. Ya no puede modificarse ni regenerarse.',
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/**
 * Detalle de campaña (diseño NexoMark). Marketero edita copy, envía a aprobación,
 * exporta PDF. LÓGICA INTACTA: fetch, autosave debounce 30s, guardar, submit+modal,
 * export PDF (blob + 402), imagen b64 + descarga, estados readonly, historial.
 * Agrega: stepper FSM del estado.
 */
export default function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [text, setText] = useState('')
  const [promptText, setPromptText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [autoSavedAt, setAutoSavedAt] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versionsRefreshKey, setVersionsRefreshKey] = useState(0)

  const debounceRef = useRef(null)
  const pollAttemptsRef = useRef(0)
  const draftKey = `campaign_${id}_draft`

  const fetchCampaign = useCallback(
    async ({ useDraft = true } = {}) => {
      const { data } = await api.get(`/api/campaigns/${id}/`)
      const c = data.data.campaign
      setCampaign(c)
      const draft = useDraft ? localStorage.getItem(draftKey) : null
      setText(draft !== null ? draft : c.texto_generado || '')
      setPromptText(c.prompt || '')
      return c
    },
    [id, draftKey],
  )

  useEffect(() => {
    async function loadCampaign() {
      try {
        await fetchCampaign()
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadCampaign()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fetchCampaign])

  useEffect(() => {
    if (campaign?.estado !== 'pendiente_ia') return undefined

    pollAttemptsRef.current = 0
    const timer = window.setInterval(async () => {
      pollAttemptsRef.current += 1

      if (pollAttemptsRef.current > 30) {
        window.clearInterval(timer)
        setRegenerating(false)
        toast.error('La IA está tardando más de lo normal. Vuelve a abrir la campaña en unos minutos.')
        return
      }

      try {
        const fresh = await fetchCampaign({ useDraft: false })
        if (fresh.estado !== 'pendiente_ia') {
          window.clearInterval(timer)
          setRegenerating(false)
          window.dispatchEvent(new Event('credits-updated'))

          if (fresh.estado === 'generado') {
            localStorage.removeItem(draftKey)
            setVersionsRefreshKey((value) => value + 1)
            toast.success('Contenido IA listo')
          } else if (fresh.ia_error_message) {
            toast.error(`La generación IA falló: ${fresh.ia_error_message}`)
          }
        }
      } catch {
        // Mantener el polling: la siguiente iteración puede recuperarse.
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [campaign?.estado, draftKey, fetchCampaign])

  // Autosave con debounce de 30s
  useEffect(() => {
    if (!campaign || READONLY_STATES.includes(campaign.estado)) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(draftKey, text)
      setAutoSavedAt(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }))
    }, 30000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [text, campaign, draftKey])

  async function handleSave() {
    setSaving(true)
    try {
      const { data } = await api.patch(`/api/campaigns/${id}/`, {
        prompt: promptText,
        texto_generado: text,
        version: campaign.version,
      })
      setCampaign(data.data.campaign)
      setPromptText(data.data.campaign.prompt || '')
      localStorage.removeItem(draftKey)
      setAutoSavedAt(null)
      toast.success('Cambios guardados')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar')
      if (err.response?.status === 409) {
        // Otra pestaña, la IA o una restauración cambió la campaña: se guarda lo
        // escrito como borrador local y se recarga la versión del servidor.
        localStorage.setItem(draftKey, text)
        fetchCampaign({ useDraft: true }).catch(() => {})
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitConfirm(destinos = []) {
    setSubmitting(true)
    setShowModal(false)
    try {
      await api.post(`/api/campaigns/${id}/submit/`, { destinos })
      localStorage.removeItem(draftKey)
      toast.success('Enviada a aprobación del cliente')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error('Cuota agotada. Pide un reset al administrador.')
      } else {
        toast.error(err.response?.data?.message || 'Error al enviar')
      }
      setSubmitting(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const { data } = await api.post(`/api/campaigns/${id}/regenerate/`)
      const c = data.data.campaign
      setCampaign(c)
      setText(c.texto_generado || '')
      localStorage.removeItem(draftKey)
      window.dispatchEvent(new Event('credits-updated'))
      toast.success(data.message || 'Regeneración iniciada')
      if (c.estado !== 'pendiente_ia') setRegenerating(false)
    } catch (err) {
      if (err.response?.status === 402) {
        toast.error('Cuota agotada. Pide un reset al administrador.')
      } else {
        toast.error(err.response?.data?.message || 'No se pudo regenerar')
      }
      setRegenerating(false)
    }
  }

  async function handleExportPDF() {
    try {
      const response = await api.get(`/api/campaigns/${id}/export-pdf/`, {
        responseType: 'blob',
      })
      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      )
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `campana_${campaign.titulo}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      let msg = 'Error al generar el PDF.'
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text())
          msg = parsed.message || msg
        } catch {
          /* usar mensaje genérico */
        }
      }
      toast.error(msg)
    }
  }

  async function handleDeleteCampaign() {
    if (!window.confirm(`¿Eliminar la campaña "${campaign.titulo}"? Esta acción no se puede deshacer.`)) {
      return
    }
    setDeleting(true)
    try {
      await api.delete(`/api/campaigns/${id}/`)
      toast.success('Campaña eliminada')
      setTimeout(() => navigate('/campaigns'), 700)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo eliminar la campaña')
      setDeleting(false)
    }
  }

  if (loading) return <LoadingSkeleton />
  if (error)
    return (
      <p className="rounded-xl border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
        Error al cargar la campaña.
      </p>
    )

  const isReadonly = READONLY_STATES.includes(campaign.estado)
  const canSubmit = campaign.estado === 'generado'
  // HU regenerar: borrador (fallo previo) o rechazado (vuelve a borrador en backend)
  const canRegenerate =
    ['borrador', 'rechazado'].includes(campaign.estado) &&
    (campaign.estado !== 'rechazado' || (campaign.rechazos_cliente_count ?? 0) < 2)
  const isGenerating = campaign.estado === 'pendiente_ia'
  const canDelete = ['borrador', 'generado'].includes(campaign.estado)
  const isFailure = campaign.estado === 'fracaso'
  const isFirstRejection = campaign.estado === 'rechazado' && (campaign.rechazos_cliente_count ?? 0) < 2

  return (
    <>
      <AppToaster />

      {/* Encabezado */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate('/campaigns')}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a campañas
          </button>
          <h1 className="truncate text-3xl font-bold tracking-tight text-on-surface">
            {campaign.titulo}
          </h1>
        </div>
        <StatusBadge estado={campaign.estado} className="px-4 py-1.5 text-sm" />
      </div>

      {/* Stepper FSM del estado */}
      <div className="mb-6 rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <CampaignStepper estado={campaign.estado} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Columna izquierda: Metadatos ── */}
        <div className="w-full shrink-0 space-y-4 lg:w-72">
          <div className="space-y-3 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <MetaRow label="Cliente">{campaign.cliente_nombre}</MetaRow>
            <MetaRow label="Industria" capitalize>{campaign.industria}</MetaRow>
            <MetaRow label="Tono" capitalize>{campaign.tono}</MetaRow>
            <MetaRow label="Plataforma" capitalize>{campaign.plataforma}</MetaRow>
            <MetaRow label="Creada">
              {new Date(campaign.fecha_creacion).toLocaleDateString('es-PE')}
            </MetaRow>
            <MetaRow label="Marketero">
              {campaign?.marketero ? String(campaign.marketero).split(' <')[0] : '—'}
            </MetaRow>
          </div>

          <div className="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Prompt original
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-on-surface-variant">
              {campaign.prompt}
            </p>
          </div>

          <VersionHistoryPanel
            campaignId={id}
            refreshKey={versionsRefreshKey}
            canRestore={['borrador', 'generado'].includes(campaign.estado)}
            onRestored={(c) => {
              setCampaign(c)
              setText(c.texto_generado || '')
              setPromptText(c.prompt || '')
              localStorage.removeItem(draftKey)
              setVersionsRefreshKey((value) => value + 1)
            }}
          />
        </div>

        {/* ── Columna derecha: Editor + Imagen ── */}
        <div className="min-w-0 flex-1">
          {isReadonly && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                campaign.estado === 'aprobado'
                  ? 'border-success/20 bg-success-container text-success'
                  : campaign.estado === 'pendiente_aprobacion'
                    ? 'border-primary/20 bg-primary/5 text-on-surface'
                    : 'border-error/20 bg-error-container text-on-error-container'
              }`}
            >
              {READONLY_MESSAGES[campaign.estado]}
            </div>
          )}

          {isFirstRejection && (
            <div className="mb-4 rounded-xl border border-warning/30 bg-warning-container px-4 py-3 text-sm font-medium text-tertiary">
              Primer rechazo del cliente. Puedes ajustar el prompt o el copy y regenerar una última versión.
            </div>
          )}

          {/* Feedback de rechazo, si existe (HU15) */}
          {campaign.estado === 'rechazado' && campaign.feedback_rechazo && (
            <div className="mb-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-error">
                Feedback del cliente
              </p>
              <p className="text-sm leading-relaxed text-on-surface">{campaign.feedback_rechazo}</p>
            </div>
          )}

          {campaign.cliente_valoracion && (
            <div className="mb-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                Valoración del cliente
              </p>
              <div className="flex items-center gap-1 text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${star <= campaign.cliente_valoracion ? 'fill-current' : 'text-outline'}`}
                  />
                ))}
                <span className="ml-2 text-sm font-semibold text-on-surface">
                  {campaign.cliente_valoracion}/5
                </span>
              </div>
            </div>
          )}

          <div className="mb-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-on-surface">Prompt de generación</p>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={isReadonly || isGenerating}
              rows={5}
              className={`w-full resize-y rounded-lg border px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary ${
                isReadonly || isGenerating
                  ? 'cursor-not-allowed border-outline-variant bg-surface-container-low text-on-surface-variant'
                  : 'border-outline-variant'
              }`}
            />
          </div>

          <div className="rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-on-surface">Copy publicitario</p>
              {autoSavedAt && (
                <p className="text-xs text-on-surface-variant">
                  Guardado automáticamente a las {autoSavedAt}
                </p>
              )}
            </div>

            {isGenerating && (
              <div className="mb-3 rounded-lg border border-primary/20 bg-primary-container px-4 py-3 text-sm text-on-primary-container">
                La IA está generando el nuevo contenido. Esta pantalla se actualizará sola.
              </div>
            )}

            {campaign.estado === 'borrador' && campaign.ia_error_message && (
              <div className="mb-3 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                La última generación IA falló: {campaign.ia_error_message}
              </div>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isReadonly || isGenerating}
              rows={16}
              className={`w-full resize-y rounded-lg border px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary ${
                isReadonly
                  ? 'cursor-not-allowed border-outline-variant bg-surface-container-low text-on-surface-variant'
                  : 'border-outline-variant'
              }`}
            />

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-on-surface-variant">{wordCount(text)} palabras</p>
              <div className="flex gap-2">
                {!isReadonly && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || isGenerating}>
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                    {canSubmit && (
                      <Button
                        size="sm"
                        onClick={() => setShowModal(true)}
                        disabled={submitting || isGenerating}
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? 'Enviando…' : 'Enviar al cliente'}
                      </Button>
                    )}
                  </>
                )}
                {canRegenerate && (
                  <Button size="sm" onClick={handleRegenerate} disabled={regenerating}>
                    <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? 'Regenerando…' : 'Regenerar con IA'}
                  </Button>
                )}
                {isGenerating && (
                  <Button size="sm" disabled>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generando…
                  </Button>
                )}
                {campaign.estado === 'aprobado' && (
                  <Button size="sm" onClick={handleExportPDF}>
                    <FileText className="h-4 w-4" />
                    Exportar PDF
                  </Button>
                )}
                {canDelete && !isFailure && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteCampaign}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleting ? 'Eliminando…' : 'Eliminar'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Publicación en redes: estado por cuenta y "Publicar ahora / Reintentar" */}
          <PublicationsPanel campaignId={campaign.id} estadoCampana={campaign.estado} />

          {/* X opcional: versión corta que el cliente aprueba aparte (no se muestra si X está apagada) */}
          {campaign.estado === 'aprobado' && <XVariantPanel campaign={campaign} />}

          {/* Imagen generada — HU22 */}
          <div className="mt-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-on-surface">Imagen generada</p>
            {campaign.imagen_b64 ? (
              <ImageLightbox
                src={`data:image/png;base64,${campaign.imagen_b64}`}
                alt="Imagen generada por IA"
                downloadName={`campaign_${id}_imagen.png`}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-on-surface-variant">
                <ImageOff className="h-8 w-8 text-outline" />
                <p className="text-sm">Imagen no generada aún</p>
                {campaign.estado === 'generado' && (
                  <p className="glass-soft mt-2 max-w-sm rounded-lg px-3 py-2 text-xs">
                    <span className="font-semibold text-primary">Activo provisional: </span>
                    el copy está listo, pero falta el activo visual. Regenerar (1 crédito)
                    vuelve a intentar copy e imagen.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <SubmitModal
          preview={text}
          clienteEmail={campaign.cliente_email}
          onConfirm={handleSubmitConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  )
}

function MetaRow({ label, children, capitalize }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className={`text-right text-on-surface ${capitalize ? 'capitalize' : ''}`}>
        {children}
      </span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex animate-pulse gap-6">
      <div className="w-72 space-y-3">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-6 rounded bg-surface-container-high" />
        ))}
      </div>
      <div className="h-72 flex-1 rounded bg-surface-container-high" />
    </div>
  )
}

function SubmitModal({ preview, clienteEmail, onConfirm, onCancel }) {
  const [destinos, setDestinos] = useState(null)
  const [elegidos, setElegidos] = useState([])

  useEffect(() => {
    let vigente = true
    socialApi
      .destinos(clienteEmail)
      .then((lista) => vigente && setDestinos(lista))
      .catch(() => vigente && setDestinos([]))
    return () => {
      vigente = false
    }
  }, [clienteEmail])

  function alternar(id) {
    setElegidos((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]))
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-sm"
    >
      <div className="glass-liquid w-full max-w-lg rounded-3xl p-8">
        <h3 id="submit-title" className="mb-1 text-lg font-semibold text-on-surface">Enviar al cliente</h3>
        <p className="mb-4 text-sm text-on-surface-variant">
          El cliente verá el siguiente copy para aprobación:
        </p>
        <div className="mb-5 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-on-surface">
          {preview}
        </div>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-semibold text-on-surface">
            Publicar automáticamente cuando el cliente apruebe en:
          </legend>
          {destinos === null ? (
            <p className="text-xs text-on-surface-variant">Cargando cuentas…</p>
          ) : destinos.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
              Ni el cliente ni tú tienen cuentas conectadas. Se enviará sin publicación automática; se
              conectan en Configuración → Redes conectadas.
            </p>
          ) : (
            <div className="space-y-2">
              {destinos.map((d) => (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant px-3 py-2 text-sm hover:bg-surface-container-low"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={elegidos.includes(d.id)}
                    onChange={() => alternar(d.id)}
                  />
                  <RedIcon red={d.red} className="h-5 w-5" />
                  <span className="flex-1 font-medium text-on-surface">{d.cuenta_nombre}</span>
                  <span className="text-xs text-on-surface-variant">
                    {d.propietario_rol === 'cliente' ? 'del cliente' : 'de la agencia'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => onConfirm(elegidos)} disabled={destinos === null}>
            Confirmar envío
          </Button>
        </div>
      </div>
    </div>
  )
}
