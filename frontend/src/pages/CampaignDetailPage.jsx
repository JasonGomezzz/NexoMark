import { useCallback, useEffect, useRef, useState } from 'react'
import PublicationsPanel from '@/components/social/PublicationsPanel'
import XVariantPanel from '@/components/social/XVariantPanel'
import TikTokPanel from '@/components/social/TikTokPanel'
import { useVerifiedUser } from '../hooks/useVerifiedUser'
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
import SelloConforme from '@/components/SelloConforme'
import { useEstacionPagina } from '@/components/linea/EstacionContext'
import { etapaDeEstado } from '@/components/linea/estaciones'

// El backend solo acepta cambios de contenido en borrador, generado o rechazado.
const READONLY_STATES = ['pendiente_aprobacion', 'aprobado', 'fracaso']

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
  // Solo el marketero dueño envía a TikTok (el servidor lo vuelve a comprobar).
  const esMarketero = useVerifiedUser()?.rol === 'marketero'

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
  // Número de la versión vigente (la primera del historial): es la que lleva el sello al aprobarse.

  // La banda de la línea marca la estación en la que está esta campaña.
  useEstacionPagina(campaign ? etapaDeEstado(campaign.estado) : null)

  const debounceRef = useRef(null)
  const pollAttemptsRef = useRef(0)
  // Alguna cuenta destino ya tiene el post: el recorrido sella Publicar y pasa a Medir.
  const [publicada, setPublicada] = useState(false)
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
      return true
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar')
      if (err.response?.status === 409) {
        // Otra pestaña, la IA o una restauración cambió la campaña: se guarda lo
        // escrito como borrador local y se recarga la versión del servidor.
        localStorage.setItem(draftKey, text)
        fetchCampaign({ useDraft: true }).catch(() => {})
      }
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitConfirm(destinos = []) {
    setSubmitting(true)
    setShowModal(false)
    // El modal promete "exactamente este copy": lo editado se guarda antes de enviar,
    // y si no se pudo guardar no se envía la versión anterior del servidor.
    const sinGuardar = text !== (campaign.texto_generado || '') || promptText !== (campaign.prompt || '')
    if (sinGuardar && !(await handleSave())) {
      setSubmitting(false)
      return
    }
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

  const fecha = new Date(campaign.fecha_creacion).toLocaleDateString('es-PE')
  const etiqueta = (valor) => (valor ? valor.charAt(0).toUpperCase() + valor.slice(1).replace('_', ' ') : 'sin dato')

  return (
    <>
      <AppToaster />

      {/* Encabezado: la campaña y dónde va en la línea */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate('/campaigns')}
          className="-ml-3 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las campañas
        </button>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <h1 className="line-clamp-3 max-w-4xl text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em] text-on-surface sm:text-[36px]">
            {campaign.titulo}
          </h1>
          <StatusBadge estado={campaign.estado} className="px-4 py-1.5 text-sm" />
        </div>
        <p className="mt-2 text-[15px] text-on-surface-variant">
          {campaign.cliente_nombre || 'Cliente sin dato'} · {etiqueta(campaign.industria)} · {etiqueta(campaign.tono)} ·{' '}
          {etiqueta(campaign.plataforma)} · creada el {fecha}
        </p>
      </div>

      <div className="mb-12">
        <CampaignStepper estado={campaign.estado} publicada={publicada} />
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        {/* ── La pieza: lo que verá y aprobará el cliente ── */}
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="pieza-titulo" className="regla pt-5">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 id="pieza-titulo" className="text-2xl font-extrabold text-on-surface">
                  La pieza
                </h2>
                <p className="text-[15px] text-on-surface-variant">
                  {isReadonly ? 'Esta es la versión que tiene el cliente.' : 'Así la verá el cliente. Puedes corregir el copy antes de enviarla.'}
                </p>
              </div>
              {autoSavedAt && <p className="text-[13px] text-on-surface-variant">Borrador guardado en este equipo a las {autoSavedAt}</p>}
            </div>

            {isGenerating && (
              <p role="status" className="mb-5 flex items-center gap-2 rounded-[10px] bg-primary-fixed px-4 py-3 text-sm text-on-primary-fixed">
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                La IA está generando el nuevo contenido. Esta pantalla se actualiza sola.
              </p>
            )}
            {campaign.estado === 'borrador' && campaign.ia_error_message && (
              <p role="alert" className="mb-5 rounded-[10px] border border-error/25 bg-error-container px-4 py-3 text-sm text-on-error-container">
                La última generación falló: {campaign.ia_error_message}
              </p>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
              <figure className="relative min-w-0">
                {campaign.imagen_b64 ? (
                  <ImageLightbox
                    src={`data:image/png;base64,${campaign.imagen_b64}`}
                    alt={`Imagen de la campaña ${campaign.titulo}`}
                    downloadName={`campaign_${id}_imagen.png`}
                  />
                ) : (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-outline-variant bg-surface-container-low p-6 text-center text-on-surface-variant">
                    <ImageOff className="h-8 w-8 text-outline" aria-hidden="true" />
                    <p className="text-sm font-medium text-on-surface">Sin imagen todavía</p>
                    {campaign.estado === 'generado' && (
                      <p className="max-w-xs text-[13px]">El copy está listo, pero falta la imagen. Regenerar (1 crédito) vuelve a intentar copy e imagen.</p>
                    )}
                  </div>
                )}
                {campaign.estado === 'aprobado' && <SelloConforme version={campaign.version} tamano={72} className="absolute -right-3 top-3 z-10" />}
              </figure>

              <div className="flex min-w-0 flex-col">
                <label htmlFor="copy" className="mb-2 text-sm font-medium text-on-surface">
                  Copy
                </label>
                <textarea
                  id="copy"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={isReadonly || isGenerating}
                  rows={12}
                  className={`min-h-64 w-full flex-1 resize-y rounded-[14px] border px-4 py-3 text-[15px] leading-relaxed outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30 ${
                    isReadonly || isGenerating
                      ? 'cursor-not-allowed border-outline-variant bg-surface-container-low text-on-surface-variant'
                      : 'border-outline bg-surface-container-lowest text-on-surface'
                  }`}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-on-surface-variant">{wordCount(text)} {wordCount(text) === 1 ? 'palabra' : 'palabras'}</p>
                  {!isReadonly && (
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || isGenerating}>
                      {saving ? 'Guardando…' : 'Guardar cambios'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Publicación en redes: estado por cuenta y "Publicar ahora / Reintentar" */}
          <PublicationsPanel
            campaignId={campaign.id}
            estadoCampana={campaign.estado}
            onCargadas={(lista) => setPublicada(lista.some((p) => p.estado === 'publicado'))}
          />

          {/* TikTok: el marketero envía lo aprobado al buzón; no se muestra si TikTok no está configurado */}
          {campaign.estado === 'aprobado' && esMarketero && <TikTokPanel campaign={campaign} />}

          {/* X opcional: versión corta que el cliente aprueba aparte (no se muestra si X está apagada) */}
          {campaign.estado === 'aprobado' && <XVariantPanel campaign={campaign} />}

          <details className="group border-t border-hairline pt-4" open={campaign.estado === 'rechazado' || campaign.estado === 'borrador'}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-display text-lg font-extrabold text-on-surface">
              Instrucciones para la IA
              <span className="text-sm font-semibold text-primary group-open:hidden">Ver</span>
              <span className="hidden text-sm font-semibold text-primary group-open:inline">Ocultar</span>
            </summary>
            <label htmlFor="prompt-generacion" className="sr-only">
              Instrucciones para la IA
            </label>
            <textarea
              id="prompt-generacion"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={isReadonly || isGenerating}
              rows={5}
              className={`mt-3 w-full resize-y rounded-[14px] border px-4 py-3 text-[15px] leading-relaxed outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30 ${
                isReadonly || isGenerating
                  ? 'cursor-not-allowed border-outline-variant bg-surface-container-low text-on-surface-variant'
                  : 'border-outline bg-surface-container-lowest text-on-surface'
              }`}
            />
            <p className="mt-2 text-[13px] text-on-surface-variant">Si las cambias, guarda antes de regenerar.</p>
          </details>
        </div>

        {/* ── Siguiente paso, datos e historial ── */}
        <aside className="min-w-0 space-y-10">
          <section aria-labelledby="siguiente-titulo" className="regla pt-5">
            <SiguientePaso
              campaign={campaign}
              canSubmit={canSubmit}
              canRegenerate={canRegenerate}
              canDelete={canDelete && !isFailure}
              isFirstRejection={isFirstRejection}
              submitting={submitting}
              regenerating={regenerating}
              deleting={deleting}
              isGenerating={isGenerating}
              onSubmit={() => setShowModal(true)}
              onRegenerate={handleRegenerate}
              onExport={handleExportPDF}
              onDelete={handleDeleteCampaign}
            />
          </section>

          <section aria-labelledby="datos-titulo" className="border-t border-hairline pt-5">
            <h2 id="datos-titulo" className="mb-2 font-display text-lg font-extrabold text-on-surface">
              Datos de la campaña
            </h2>
            <dl className="divide-y divide-hairline">
              <MetaRow label="Cliente">{campaign.cliente_nombre || 'sin dato'}</MetaRow>
              <MetaRow label="Correo del cliente">{campaign.cliente_email || 'sin dato'}</MetaRow>
              <MetaRow label="Industria">{etiqueta(campaign.industria)}</MetaRow>
              <MetaRow label="Tono">{etiqueta(campaign.tono)}</MetaRow>
              <MetaRow label="Plataforma">{etiqueta(campaign.plataforma)}</MetaRow>
              <MetaRow label="Creada">{fecha}</MetaRow>
              <MetaRow label="Marketero">{campaign?.marketero ? String(campaign.marketero).split(' <')[0] : 'sin dato'}</MetaRow>
            </dl>
          </section>

          <VersionHistoryPanel
            campaignId={id}
            refreshKey={versionsRefreshKey}
            textoActual={campaign.texto_generado}
            canRestore={['borrador', 'generado'].includes(campaign.estado)}
            onRestored={(c) => {
              setCampaign(c)
              setText(c.texto_generado || '')
              setPromptText(c.prompt || '')
              localStorage.removeItem(draftKey)
              setVersionsRefreshKey((value) => value + 1)
            }}
          />
        </aside>
      </div>

      {/* Móvil: la acción principal queda al alcance del pulgar */}
      {canSubmit && (
        <>
          <div aria-hidden="true" className="h-20 lg:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant bg-background/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
            <Button size="lg" className="w-full" onClick={() => setShowModal(true)} disabled={submitting || isGenerating}>
              <Send className="h-5 w-5" aria-hidden="true" />
              {submitting ? 'Enviando…' : 'Enviar al cliente'}
            </Button>
          </div>
        </>
      )}

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

function Titulo({ children }) {
  return (
    <h2 id="siguiente-titulo" className="text-2xl font-extrabold leading-tight text-on-surface">
      {children}
    </h2>
  )
}

function Valoracion({ valor }) {
  if (!valor) return null
  return (
    <p className="mt-3 flex items-center gap-1 text-on-surface" aria-label={`Valoración del cliente: ${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} aria-hidden="true" className={`h-5 w-5 ${star <= valor ? 'fill-tertiary text-tertiary' : 'text-outline'}`} />
      ))}
      <span className="ml-2 text-sm font-semibold">{valor}/5</span>
    </p>
  )
}

/** El siguiente paso de la campaña en la línea, según su estado. */
function SiguientePaso({
  campaign,
  canSubmit,
  canRegenerate,
  canDelete,
  isFirstRejection,
  submitting,
  regenerating,
  deleting,
  isGenerating,
  onSubmit,
  onRegenerate,
  onExport,
  onDelete,
}) {
  const estado = campaign.estado

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-on-surface-variant">Siguiente paso</p>
      {estado === 'generado' && (
        <>
          <Titulo>Enviar al cliente</Titulo>
          <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
            Lo revisará <strong className="font-semibold text-on-surface [overflow-wrap:anywhere]">{campaign.cliente_email || 'el cliente'}</strong>. Al enviarla eliges dónde se publica cuando la apruebe.
          </p>
        </>
      )}
      {estado === 'pendiente_ia' && (
        <>
          <Titulo>Generando</Titulo>
          <p className="mt-2 text-[15px] text-on-surface-variant">La IA está creando el copy y la imagen.</p>
        </>
      )}
      {estado === 'borrador' && (
        <>
          <Titulo>Generar la pieza</Titulo>
          <p className="mt-2 text-[15px] text-on-surface-variant">Todavía no hay copy ni imagen. Generar usa 1 crédito y se devuelve si la IA falla.</p>
        </>
      )}
      {estado === 'pendiente_aprobacion' && (
        <>
          <Titulo>Esperando al cliente</Titulo>
          <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">
            {campaign.cliente_email || 'El cliente'} está revisando esta versión. No se puede editar hasta que decida.
          </p>
        </>
      )}
      {estado === 'rechazado' && (
        <>
          <Titulo>El cliente pidió cambios</Titulo>
          {campaign.feedback_rechazo ? (
            <blockquote className="mt-3 rounded-[10px] bg-error-container px-4 py-3 text-[15px] leading-relaxed text-on-error-container">«{campaign.feedback_rechazo}»</blockquote>
          ) : (
            <p className="mt-2 text-[15px] text-on-surface-variant">El cliente no dejó comentario.</p>
          )}
          {isFirstRejection && (
            <p className="mt-3 text-[15px] text-on-surface-variant">Es el primer rechazo: ajusta las instrucciones o el copy y regenera una última versión.</p>
          )}
          <Valoracion valor={campaign.cliente_valoracion} />
        </>
      )}
      {estado === 'aprobado' && (
        <>
          <Titulo>Aprobada por el cliente</Titulo>
          <p className="mt-2 text-[15px] text-on-surface-variant">Esta es la versión que se publica. Ya no se puede editar.</p>
          <Valoracion valor={campaign.cliente_valoracion} />
        </>
      )}
      {estado === 'fracaso' && (
        <>
          <Titulo>Campaña cerrada</Titulo>
          <p className="mt-2 text-[15px] text-on-surface-variant">El cliente la rechazó dos veces. Ya no puede modificarse ni regenerarse.</p>
          <Valoracion valor={campaign.cliente_valoracion} />
        </>
      )}

      <div className="mt-5 grid gap-2">
        {canSubmit && (
          <Button size="lg" onClick={onSubmit} disabled={submitting || isGenerating}>
            <Send className="h-5 w-5" aria-hidden="true" />
            {submitting ? 'Enviando…' : 'Enviar al cliente'}
          </Button>
        )}
        {canRegenerate && (
          <Button size="lg" onClick={onRegenerate} disabled={regenerating}>
            <RefreshCw className={`h-5 w-5 ${regenerating ? 'animate-spin' : ''}`} aria-hidden="true" />
            {regenerating ? 'Regenerando…' : 'Regenerar con IA · 1 crédito'}
          </Button>
        )}
        {isGenerating && (
          <Button size="lg" disabled>
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            Generando…
          </Button>
        )}
        {estado === 'aprobado' && (
          <Button variant="outline" onClick={onExport}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Exportar PDF
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" onClick={onDelete} disabled={deleting} className="hover:bg-error-container hover:text-on-error-container">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {deleting ? 'Eliminando…' : 'Eliminar campaña'}
          </Button>
        )}
      </div>
    </div>
  )
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 break-words text-right text-on-surface">{children}</dd>
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 p-0 sm:items-center sm:p-4"
    >
      <div className="entra-hoja max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] border border-outline-variant bg-surface-container-lowest p-6 shadow-xl sm:rounded-[22px] sm:p-8">
        <h3 id="submit-title" className="mb-1 font-display text-2xl font-extrabold text-on-surface">Enviar al cliente</h3>
        <p className="mb-4 text-sm text-on-surface-variant">
          El cliente aprobará exactamente este copy y la imagen de la campaña:
        </p>
        <div className="mb-6 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-on-surface">
          {preview}
        </div>

        <fieldset className="mb-5">
          <legend className="mb-1 font-display text-lg font-extrabold text-on-surface">¿Dónde se publica al aprobarla?</legend>
          <p className="mb-3 text-[13px] text-on-surface-variant">Se publica sola en las cuentas que marques, apenas el cliente la apruebe.</p>
          {destinos === null ? (
            <p className="text-sm text-on-surface-variant">Cargando cuentas…</p>
          ) : destinos.length === 0 ? (
            <p className="rounded-[10px] bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              Ni el cliente ni tú tienen cuentas conectadas: se enviará sin publicación automática. Se conectan en
              Configuración, en «Redes conectadas».
            </p>
          ) : (
            <div className="space-y-2">
              {destinos.map((d) => (
                <label
                  key={d.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-outline-variant px-3 text-sm transition-colors hover:bg-surface-container-low has-[:checked]:border-primary has-[:checked]:bg-primary-fixed"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={elegidos.includes(d.id)}
                    onChange={() => alternar(d.id)}
                  />
                  <RedIcon red={d.red} className="h-5 w-5" />
                  <span className="flex-1 font-medium text-on-surface">{d.cuenta_nombre}</span>
                  <span className="text-[13px] text-on-surface-variant">
                    {d.propietario_rol === 'cliente' ? 'del cliente' : 'de la agencia'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => onConfirm(elegidos)} disabled={destinos === null}>
            {elegidos.length ? `Enviar y publicar en ${elegidos.length}` : 'Enviar sin publicar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
