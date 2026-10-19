import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Bot, Sparkles, Lightbulb } from 'lucide-react'
import ImageLightbox from '@/components/ui/ImageLightbox'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/StatusBadge'
import GeneratingState from '@/components/campaign/GeneratingState'
import ErrorState from '@/components/campaign/ErrorState'
import CreditsExhausted from '@/components/campaign/CreditsExhausted'
import PlatformIcon from '@/components/campaign/PlatformIcon'
import { VoiceDictationButton } from '@/components/voice/GeminiVoiceControls'

const INDUSTRIAS = [
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'salud', label: 'Salud' },
  { value: 'educacion', label: 'Educación' },
  { value: 'retail', label: 'Retail' },
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'moda', label: 'Moda' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'entretenimiento', label: 'Entretenimiento' },
  { value: 'otro', label: 'Otro' },
]

// Valores EXACTOS de CampaignTono/CampaignPlataforma del backend —
// un valor fuera de choices (p. ej. 'persuasivo' o 'tiktok') devuelve 400.
const TONOS = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'inspiracional', label: 'Inspiracional' },
  { value: 'humoristico', label: 'Humorístico' },
]

const PLATAFORMAS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'tiktok', label: 'TikTok' },
]

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-error">{message}</p>
}

function inputCls(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary ${
    hasError ? 'border-error' : 'border-outline-variant'
  }`
}

export default function NewCampaignPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { campaign, warning }
  const [serverError, setServerError] = useState('')
  const [noCredits, setNoCredits] = useState(false)

  // Prellenado desde la Guía de prompts (state del router; no persiste al recargar)
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      prompt: location.state?.prompt || '',
      tono: location.state?.tono || '',
      plataformas: [],
    },
  })
  const cursorPositionsRef = useRef({})

  function insertTranscript(fieldName, transcript) {
    const current = getValues(fieldName) || ''
    const position = cursorPositionsRef.current[fieldName]
    const start = position?.start ?? current.length
    const end = position?.end ?? start
    const separator = start > 0 && !/\s$/.test(current.slice(0, start)) ? ' ' : ''
    const next = `${current.slice(0, start)}${separator}${transcript}${current.slice(end)}`
    const cursor = start + separator.length + transcript.length
    setValue(fieldName, next, { shouldDirty: true, shouldValidate: true })
    window.setTimeout(() => {
      const field = document.querySelector(`[name="${fieldName}"]`)
      field?.focus()
      field?.setSelectionRange(cursor, cursor)
    })
  }

  function rememberCursor(fieldName, event) {
    cursorPositionsRef.current[fieldName] = {
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    }
  }

  // Polling del modo REAL: la generación es asíncrona (Django responde 202 con
  // estado pendiente_ia y n8n tarda 8-30 s). Consultamos la campaña cada 4 s
  // hasta que salga de pendiente_ia (máx ~2 min). En mock no aplica (llega
  // 'generado' de inmediato).
  const pollAttempts = useRef(0)
  useEffect(() => {
    const c = result?.campaign
    if (!c || c.estado !== 'pendiente_ia') return
    pollAttempts.current = 0
    const timer = setInterval(() => {
      pollAttempts.current += 1
      if (pollAttempts.current > 30) {
        clearInterval(timer)
        setResult((r) => ({
          ...r,
          warning: 'La IA está tardando más de lo normal. Revisa la campaña en la lista en unos minutos.',
        }))
        return
      }
      api
        .get(`/api/campaigns/${c.id}/`)
        .then(({ data }) => {
          const fresh = data.data.campaign
          if (fresh.estado !== 'pendiente_ia') {
            clearInterval(timer)
            setResult({
              campaign: fresh,
              warning:
                fresh.estado === 'borrador' && fresh.ia_error_message
                  ? `La generación IA falló: ${fresh.ia_error_message}`
                  : null,
            })
            window.dispatchEvent(new Event('credits-updated'))
          }
        })
        .catch(() => {})
    }, 4000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.campaign?.id, result?.campaign?.estado])

  async function onSubmit(formData) {
    setSubmitting(true)
    setServerError('')
    setNoCredits(false)
    setResult(null)

    try {
      const { data } = await api.post('/api/campaigns/', formData)
      const campaign = data.data.campaign
      setResult({
        campaign,
        warning:
          campaign?.estado === 'borrador' && campaign?.ia_error_message
            ? `La generación IA falló: ${campaign.ia_error_message}`
            : null,
      })
      // El crédito ya se descontó — que el sidebar lo refleje al instante
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err) {
      const httpStatus = err.response?.status
      const body = err.response?.data

      if (httpStatus === 400) {
        const errMap = body?.data?.errors ?? {}
        const first = Object.values(errMap)[0]?.[0]
        setServerError(first || 'Error de validación. Revisa los campos.')
      } else if (httpStatus === 402) {
        // Sin créditos → estado dedicado (HU24)
        setNoCredits(true)
      } else if (httpStatus === 503) {
        // Campaña guardada como borrador pero IA falló
        setResult({ campaign: body?.data?.campaign, warning: body?.message })
      } else {
        setServerError('Error inesperado. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setResult(null)
    setServerError('')
    setNoCredits(false)
    reset()
  }

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a campañas
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Nueva campaña</h1>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Panel de configuración ── */}
        <div className="min-w-0 flex-1">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5 rounded-xl border border-outline-variant bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-sm font-bold text-on-surface-variant">
                1
              </span>
              <h2 className="text-xl font-semibold text-on-surface">Configuración</h2>
            </div>

            {/* Título */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-on-surface-variant">
                  Título de la campaña
                </label>
                <VoiceDictationButton
                  disabled={submitting}
                  onTranscript={(text) => insertTranscript('titulo', text)}
                  onError={setServerError}
                />
              </div>
              <input
                type="text"
                placeholder="Ej: Lanzamiento Black Friday 2026"
                className={inputCls(errors.titulo)}
                disabled={submitting}
                onSelect={(event) => rememberCursor('titulo', event)}
                {...register('titulo', {
                  required: 'El título es obligatorio.',
                  minLength: { value: 5, message: 'Mínimo 5 caracteres.' },
                  maxLength: { value: 200, message: 'Máximo 200 caracteres.' },
                })}
              />
              <FieldError message={errors.titulo?.message} />
            </div>

            {/* Cliente — nombre + email */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-on-surface-variant">
                    Nombre del cliente
                  </label>
                  <VoiceDictationButton
                    disabled={submitting}
                    onTranscript={(text) => insertTranscript('cliente_nombre', text)}
                    onError={setServerError}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Ej: Empresa S.A.C."
                  className={inputCls(errors.cliente_nombre)}
                  disabled={submitting}
                  onSelect={(event) => rememberCursor('cliente_nombre', event)}
                  {...register('cliente_nombre', {
                    required: 'El nombre del cliente es obligatorio.',
                    maxLength: { value: 150, message: 'Máximo 150 caracteres.' },
                  })}
                />
                <FieldError message={errors.cliente_nombre?.message} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface-variant">
                  Email del cliente
                </label>
                <input
                  type="email"
                  placeholder="cliente@empresa.com"
                  className={inputCls(errors.cliente_email)}
                  disabled={submitting}
                  {...register('cliente_email', {
                    required: 'El email del cliente es obligatorio.',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Formato de email inválido.',
                    },
                  })}
                />
                <FieldError message={errors.cliente_email?.message} />
              </div>
            </div>

            {/* Industria + Tono */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface-variant">
                  Industria
                </label>
                <select
                  className={inputCls(errors.industria)}
                  disabled={submitting}
                  {...register('industria', { required: 'Selecciona una industria.' })}
                >
                  <option value="">Seleccionar…</option>
                  {INDUSTRIAS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.industria?.message} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-on-surface-variant">
                  Tono del mensaje
                </label>
                <select
                  className={inputCls(errors.tono)}
                  disabled={submitting}
                  {...register('tono', { required: 'Selecciona un tono.' })}
                >
                  <option value="">Seleccionar…</option>
                  {TONOS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.tono?.message} />
              </div>
            </div>

            {/* Plataformas */}
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-on-surface-variant">
                Plataformas de publicación
              </legend>
              <p className="mb-3 text-xs text-on-surface-variant">
                Puedes elegir una o varias. La IA adaptará la campaña a todas las seleccionadas.
              </p>
              <div
                className={`grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-3 ${
                  errors.plataformas ? 'border-error' : 'border-outline-variant'
                }`}
              >
                {PLATAFORMAS.map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface transition hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary-container has-[:checked]:font-semibold has-[:checked]:text-primary"
                  >
                    <input
                      type="checkbox"
                      value={value}
                      disabled={submitting}
                      className="h-4 w-4 accent-primary"
                      {...register('plataformas', {
                        validate: (values) =>
                          values?.length > 0 || 'Selecciona al menos una plataforma.',
                      })}
                    />
                    <PlatformIcon platform={value} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <FieldError message={errors.plataformas?.message} />
            </fieldset>

            {/* Prompt */}
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-on-surface-variant">
                  Instrucciones para la IA
                </label>
                <VoiceDictationButton
                  disabled={submitting}
                  onTranscript={(text) => insertTranscript('prompt', text)}
                  onError={setServerError}
                />
              </div>
              <textarea
                rows={5}
                placeholder="Describe el objetivo de la campaña, el público objetivo, puntos clave a destacar y cualquier restricción creativa…"
                className={`${inputCls(errors.prompt)} resize-y`}
                disabled={submitting}
                onSelect={(event) => rememberCursor('prompt', event)}
                {...register('prompt', {
                  required: 'Las instrucciones son obligatorias.',
                  minLength: { value: 10, message: 'Mínimo 10 caracteres.' },
                  maxLength: { value: 2000, message: 'Máximo 2000 caracteres.' },
                })}
              />
              <FieldError message={errors.prompt?.message} />
            </div>

            {serverError && (
              <p className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
                {serverError}
              </p>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              <Bot aria-hidden="true" className="h-5 w-5" />
              {submitting ? 'Generando con IA…' : 'Generar campaña con IA'}
            </Button>
          </form>

          {/* Consejo estratégico — de la screen Stitch ai_generation_loading_state */}
          <aside className="glass-soft mt-5 rounded-xl p-6">
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Sparkles className="h-4 w-4" />
              Consejo estratégico
            </p>
            <h3 className="mb-3 text-base font-bold text-on-surface">
              De brief de cliente a prompt maestro
            </h3>
            <p className="mb-4 text-sm text-on-surface-variant">
              Para que la campaña de tu cliente destaque, recuerda:
            </p>
            <ol className="space-y-3 text-sm leading-relaxed text-on-surface-variant">
              <li>
                <strong className="text-on-surface">1. Identidad de marca:</strong> incluye el
                tipo de negocio (ej. «boutique de lujo» o «startup tecnológica»).
              </li>
              <li>
                <strong className="text-on-surface">2. Objetivo del cliente:</strong> ¿buscan
                ventas directas o posicionar su marca?
              </li>
              <li>
                <strong className="text-on-surface">3. Estilo visual:</strong> define si
                prefieren algo minimalista o cargado de energía.
              </li>
            </ol>
            <Link
              to="/prompt-guide"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Lightbulb className="h-4 w-4" />
              Ver guía completa de prompts
            </Link>
          </aside>
        </div>

        {/* ── Panel de resultado / estado ── */}
        <div className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[440px]">
          {noCredits ? (
            <CreditsExhausted onClose={handleReset} />
          ) : submitting || result?.campaign?.estado === 'pendiente_ia' ? (
            <GeneratingState onCancel={handleReset} />
          ) : result?.warning ? (
            <ErrorState
              message={result.warning}
              onRetry={handleSubmit(onSubmit)}
              onEditBrief={handleReset}
            />
          ) : result ? (
            <ResultPanel
              result={result}
              onReset={handleReset}
              onNavigate={() => navigate('/campaigns')}
            />
          ) : (
            <EmptyResultPanel />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyResultPanel() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot aria-hidden="true" className="h-7 w-7" />
      </div>
      <p className="text-sm font-medium text-on-surface">El resultado de la IA aparecerá aquí</p>
      <p className="mt-1 text-xs text-on-surface-variant">
        Completa el formulario y genera tu campaña.
      </p>
    </div>
  )
}

function ResultPanel({ result, onReset, onNavigate }) {
  const { campaign } = result

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
        <span className="text-sm font-semibold text-on-surface">Resultado IA</span>
        {campaign?.estado && <StatusBadge estado={campaign.estado} />}
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Copy publicitario
          </p>
          <div className="whitespace-pre-wrap rounded-lg bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface">
            {Object.keys(campaign?.textos_por_plataforma || {}).length
              ? Object.entries(campaign.textos_por_plataforma).map(([platform, copy]) => <section key={platform} className="mb-4">
                <h3 className="font-semibold">{platform === 'twitter' ? 'Twitter / X' : platform}</h3><p>{copy}</p>
              </section>)
              : campaign?.texto_generado || '—'}
          </div>
        </div>

        {campaign?.imagen_b64 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Imagen generada
            </p>
            <ImageLightbox
              src={`data:image/png;base64,${campaign.imagen_b64}`}
              alt="Imagen generada por IA"
              downloadName={`campaign_${campaign.id}_imagen.png`}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={onNavigate}>
            Ver en lista
          </Button>
          <Button variant="outline" className="flex-1" onClick={onReset}>
            Crear otra
          </Button>
        </div>
      </div>
    </div>
  )
}
