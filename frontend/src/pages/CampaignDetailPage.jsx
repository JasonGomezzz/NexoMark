import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { ArrowLeft, FileText, ImageOff, RefreshCw, Send, Star, Trash2 } from 'lucide-react'
import CampaignPlatforms from '@/components/campaign/CampaignPlatforms'
import PublicationStatistics from '@/components/campaign/PublicationStatistics'
import PlatformIcon from '@/components/campaign/PlatformIcon'
import ImageLightbox from '@/components/ui/ImageLightbox'
import api from '../services/api'
import { getApprovedPublicationCopy } from '../services/campaignPublication'
import VersionHistoryPanel from '../components/VersionHistoryPanel'
import InstagramPublicationDialog from '../components/InstagramPublicationDialog'
import FacebookPublicationDialog from '../components/FacebookPublicationDialog'
import XPublicationDialog from '../components/XPublicationDialog'
import TikTokUploadDialog from '../components/TikTokUploadDialog'
import PlatformContentEditor from '../components/campaign/PlatformContentEditor'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import CampaignStepper from '@/components/CampaignStepper'
import { VoiceDictationButton, VoicePlaybackButton } from '@/components/voice/GeminiVoiceControls'

const READONLY_STATES = ['aprobado', 'fracaso']

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn (retirada)',
  google_ads: 'Google Ads (retirada)',
  tiktok: 'TikTok',
}

const PLATFORM_PUBLISH_URLS = {
  instagram: () => 'https://www.instagram.com/',
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/**
 * Detalle de campaña (Lumina Creative). Marketero edita copy, envía a aprobación,
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
  const [showInstagram, setShowInstagram] = useState(false)
  const [showFacebook, setShowFacebook] = useState(false)
  const [showX, setShowX] = useState(false)
  const [showTikTok, setShowTikTok] = useState(false)
  const [platformDirty, setPlatformDirty] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [versionsRefreshKey, setVersionsRefreshKey] = useState(0)

  const debounceRef = useRef(null)
  const pollAttemptsRef = useRef(0)
  const draftKey = `campaign_${id}_draft`
  const promptRef = useRef(null)
  const copyRef = useRef(null)

  function insertAtCursor(ref, value, setter, transcript) {
    const element = ref.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? start
    const separator = start > 0 && !/\s$/.test(value.slice(0, start)) ? ' ' : ''
    const next = `${value.slice(0, start)}${separator}${transcript}${value.slice(end)}`
    const cursor = start + separator.length + transcript.length
    setter(next)
    window.setTimeout(() => {
      element?.focus()
      element?.setSelectionRange(cursor, cursor)
    })
  }

  const refreshPublicationStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/campaigns/${id}/`)
      setCampaign(previous => previous ? { ...previous, publication_status: data.data.campaign.publication_status } : previous)
    } catch { /* Keep the current form and saved status if this read fails. */ }
  }, [id])

  const fetchCampaign = useCallback(
    async ({ useDraft = true } = {}) => {
      const { data } = await api.get(`/api/campaigns/${id}/`)
      const c = data.data.campaign
      setCampaign(c)
      const draft = useDraft && ['borrador', 'generado', 'rechazado'].includes(c.estado) ? localStorage.getItem(draftKey) : null
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
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitConfirm() {
    setSubmitting(true)
    setShowModal(false)
    try {
      await api.post(`/api/campaigns/${id}/submit/`, { version: campaign.version })
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

  async function handlePreparePublication(platform) {
    const approvedCopy = getApprovedPublicationCopy(campaign, platform)
    if (approvedCopy === null) {
      toast.error('Disponible cuando el cliente apruebe la campaña.')
      return
    }
    if (platform === 'instagram') {
      setShowInstagram(true)
      return
    }
    if (platform === 'facebook') {
      setShowFacebook(true)
      return
    }
    if (platform === 'twitter') {
      setShowX(true)
      return
    }
    if (platform === 'tiktok') {
      setShowTikTok(true)
      return
    }
    const destination = PLATFORM_PUBLISH_URLS[platform]?.(approvedCopy)
    if (!destination) return

    // Abrir durante el clic evita que el navegador bloquee la nueva pestaña.
    window.open(destination, '_blank', 'noopener,noreferrer')
    try {
      await navigator.clipboard.writeText(approvedCopy)
      toast.success(`Copy copiado. Completa la publicación en ${PLATFORM_LABELS[platform]}.`)
    } catch {
      toast.success(`Se abrió ${PLATFORM_LABELS[platform]}. Copia el texto desde esta campaña.`)
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

  const isReadonly = READONLY_STATES.includes(campaign.estado) || ['pendiente_aprobacion', 'pendiente_ia'].includes(campaign.estado)
  const canSubmit = campaign.estado === 'generado'
  const canPreparePublication = getApprovedPublicationCopy(campaign) !== null
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
            <MetaRow label="Plataformas">
              <CampaignPlatforms campaign={campaign} />
            </MetaRow>
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
            canRestore={['borrador', 'generado'].includes(campaign.estado) && !platformDirty && text === campaign.texto_generado && promptText === campaign.prompt}
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
          <PublicationStatistics campaignId={campaign.id} onSynchronized={refreshPublicationStatus} />
          {campaign.texto_generado && <PlatformContentEditor key={`${campaign.id}-${campaign.version}`} campaign={campaign}
            onPrepareX={() => setShowX(true)}
            disabled={saving || submitting || text !== campaign.texto_generado || promptText !== campaign.prompt}
            onDirty={setPlatformDirty} onSaved={c => { setCampaign(c); setText(c.texto_generado || ''); setPlatformDirty(false); setVersionsRefreshKey(value => value + 1) }} />}
          {isReadonly && (
            <div
              className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                campaign.estado === 'aprobado'
                  ? 'border-success/20 bg-success-container text-success'
                  : 'border-error/20 bg-error-container text-on-error-container'
              }`}
            >
              {campaign.estado === 'aprobado'
                ? 'Esta campaña fue aprobada. El texto está bloqueado.'
                : campaign.estado === 'fracaso' ? 'Esta campaña fue rechazada dos veces y quedó en fracaso. Ya no puede modificarse ni regenerarse.'
                : 'El contenido está bloqueado mientras se genera o se revisa por el cliente.'}
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-on-surface">Prompt de generación</p>
              <div className="flex gap-2">
                <VoicePlaybackButton text={promptText} disabled={isGenerating} />
                <VoiceDictationButton
                  disabled={isReadonly || isGenerating}
                  onTranscript={(transcript) =>
                    insertAtCursor(promptRef, promptText, setPromptText, transcript)
                  }
                  onError={(message) => toast.error(message)}
                />
              </div>
            </div>
            <textarea
              ref={promptRef}
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
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-on-surface">Texto base de generación</p>
                <VoicePlaybackButton text={text} disabled={isGenerating} />
                <VoiceDictationButton
                  disabled={isReadonly || isGenerating}
                  onTranscript={(transcript) => insertAtCursor(copyRef, text, setText, transcript)}
                  onError={(message) => toast.error(message)}
                />
              </div>
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
              ref={copyRef}
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
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || platformDirty}>
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                    {canSubmit && (
                      <Button
                        size="sm"
                        onClick={() => setShowModal(true)}
                        disabled={submitting || isGenerating || platformDirty || text !== campaign.texto_generado || promptText !== campaign.prompt}
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

          {campaign.texto_generado && (
            <div className="mt-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-semibold text-on-surface">Preparar publicación</p>
                {!canPreparePublication && (
                  <p id="publication-approval-notice" className="mt-2 text-sm text-on-surface-variant">
                    Disponible cuando el cliente apruebe la campaña.
                  </p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                  Instagram, Facebook y X muestran la imagen y el texto aprobado para elegir el destino y confirmar la publicación.
                  TikTok envía un borrador que debes terminar de publicar en su app.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(campaign.plataformas?.length ? campaign.plataformas : [campaign.plataforma]).filter((platform) => !['linkedin', 'google_ads'].includes(platform)).map(
                  (platform) => (
                    <Button
                      key={platform}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!canPreparePublication}
                      aria-describedby={!canPreparePublication ? 'publication-approval-notice' : undefined}
                      onClick={() => handlePreparePublication(platform)}
                    >
                      <PlatformIcon platform={platform} className="h-4 w-4" />
                      Preparar para {PLATFORM_LABELS[platform] || platform}
                    </Button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showInstagram && <InstagramPublicationDialog campaign={campaign} onClose={() => { setShowInstagram(false); fetchCampaign({ useDraft: false }).catch(() => {}) }} />}
      {showFacebook && <FacebookPublicationDialog campaign={campaign} onClose={() => { setShowFacebook(false); fetchCampaign({ useDraft: false }).catch(() => {}) }} />}
      {showX && <XPublicationDialog campaign={campaign} onClose={() => { setShowX(false); fetchCampaign({ useDraft: false }).catch(() => {}) }} />}
      {showTikTok && <TikTokUploadDialog campaign={campaign} onClose={() => { setShowTikTok(false); fetchCampaign({ useDraft: false }).catch(() => {}) }} />}
      {showModal && (
        <SubmitModal
          preview={Object.keys(campaign.textos_por_plataforma || {}).length
            ? Object.entries(campaign.textos_por_plataforma).map(([platform, copy]) => `${PLATFORM_LABELS[platform] || platform}\n${copy}`).join('\n\n')
            : text}
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

function SubmitModal({ preview, onConfirm, onCancel }) {
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
          El cliente revisará los siguientes textos y la imagen compartida. Su aprobación incluye todas las versiones:
        </p>
        <div className="mb-5 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-on-surface">
          {preview}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={onConfirm}>
            Confirmar envío
          </Button>
        </div>
      </div>
    </div>
  )
}
