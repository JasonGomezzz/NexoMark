import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Check, Lightbulb, Loader2, Wand2, TriangleAlert } from 'lucide-react'
import api from '../services/api'
import { Button, ButtonLink } from '@/components/ui/button'
import GeneratingState from '@/components/campaign/GeneratingState'
import ErrorState from '@/components/campaign/ErrorState'
import CreditsExhausted from '@/components/campaign/CreditsExhausted'
import VoiceBriefCard from '@/components/campaign/VoiceBriefCard'
import useBriefDictado from '../hooks/useBriefDictado'
import { camposParaFormulario } from '../services/voiceIntent'
import { cn } from '@/lib/utils'
import { INDUSTRIAS, PLATAFORMAS, TONOS } from '@/lib/etiquetas'

// Opciones que el formulario acepta: lo que interprete la IA fuera de estas
// listas no se vuelca y queda para que el usuario lo elija.
const OPCIONES_FORMULARIO = {
  industria: INDUSTRIAS.map((o) => o.value),
  tono: TONOS.map((o) => o.value),
  plataforma: PLATAFORMAS.map((o) => o.value),
}

// Los 7 campos, en el orden del formulario y de la "próxima estación".
// `ayuda`: por qué se pide o qué formato lleva (va debajo; el error la reemplaza).
// `max`: límite del servidor, con contador visible.
const CAMPOS = [
  { campo: 'titulo', label: 'Título', ayuda: 'Lo ve el cliente al revisar la campaña.', max: 200 },
  { campo: 'cliente_nombre', label: 'Cliente', ayuda: 'La marca o el negocio para el que es la campaña.' },
  { campo: 'cliente_email', label: 'Correo del cliente', ayuda: 'Ahí recibe la campaña para aprobarla.' },
  { campo: 'industria', label: 'Industria' },
  { campo: 'tono', label: 'Tono' },
  { campo: 'plataforma', label: 'Plataforma', ayuda: 'Orienta el largo y el estilo del copy. Dónde se publica se elige al enviarla.' },
  { campo: 'prompt', label: 'Instrucciones para la IA', ayuda: 'Objetivo, público, lo que hay que destacar y lo que no debe aparecer.', max: 2000 },
]

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-[13px] font-medium text-error">
      {message}
    </p>
  )
}

function inputCls(hasError) {
  return cn(
    'h-11 w-full rounded-[10px] border bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60',
    hasError ? 'border-error' : 'border-outline',
  )
}

/** Marca de cada campo tras interpretar: lo propuso la IA o falta completarlo. */
function MarcaCampo({ estado }) {
  if (estado === 'ia')
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        propuesto por la IA
      </span>
    )
  if (estado === 'falta')
    return <span className="rounded-full bg-warning-container px-2 py-0.5 text-[13px] font-semibold text-tertiary">falta</span>
  return null
}

export default function NewCampaignPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { campaign, warning, demora }
  // Un solo envío a la vez: el estado `submitting` llega un render tarde y un doble
  // clic podría crear dos campañas (y cobrar dos créditos).
  const enviando = useRef(false)
  // Lo último que la IA puso en cada campo: al reinterpretar solo se reemplaza lo que
  // el usuario no corrigió a mano.
  const valoresIa = useRef({})
  const [serverError, setServerError] = useState('')
  const [noCredits, setNoCredits] = useState(false)
  // Intención creada al interpretar el brief (voz o texto). Si existe, el
  // formulario confirma esa intención en vez de crear la campaña directamente.
  const [intent, setIntent] = useState(null)
  const [resumenIntent, setResumenIntent] = useState(null)
  // Columna derecha: la próxima estación (campos por completar) o el formulario.
  // Si llega un prompt desde la Guía, se abre el formulario directamente.
  const [vista, setVista] = useState(location.state?.prompt ? 'formulario' : 'proxima')

  // Prellenado desde la Guía de prompts (state del router; no persiste al recargar)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm({
    // El error aparece al salir del campo (no mientras se escribe) y luego se corrige en vivo.
    mode: 'onTouched',
    defaultValues: {
      prompt: location.state?.prompt || '',
      tono: location.state?.tono || '',
    },
  })

  // Contadores de los campos con límite (titulo, prompt).
  const [tituloActual, promptActual] = useWatch({ control, name: ['titulo', 'prompt'] })
  const largos = { titulo: tituloActual, prompt: promptActual }

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
        // No es un fallo: la generación sigue en el servidor y no se devolvió el crédito.
        clearInterval(timer)
        setResult((r) => ({ ...r, demora: true }))
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

  // Generada: la campaña sigue su viaje en su propia pantalla, donde se revisa
  // y se envía al cliente (no hay un "resultado" que obligue a volver a la lista).
  useEffect(() => {
    const c = result?.campaign
    if (!c?.id || result.warning || result.demora || c.estado === 'pendiente_ia') return
    navigate(`/campaigns/${c.id}`, { state: { recienGenerada: true } })
  }, [result, navigate])

  const handleInterpreted = useCallback(
    (nuevoIntent) => {
      const { valores, completados } = camposParaFormulario(nuevoIntent.campos_finales, OPCIONES_FORMULARIO)
      const actuales = getValues()
      Object.entries(valores).forEach(([campo, valor]) => {
        const actual = actuales[campo] ?? ''
        const corregidoAMano = actual !== '' && actual !== (valoresIa.current[campo] ?? '')
        if (corregidoAMano) return
        valoresIa.current[campo] = valor
        setValue(campo, valor, { shouldValidate: true, shouldDirty: true })
      })
      setIntent(nuevoIntent)
      setResumenIntent({ completados, advertencias: nuevoIntent.advertencias ?? [] })
      setServerError('')
      setVista('formulario')
    },
    [getValues, setValue],
  )
  const brief = useBriefDictado({ onInterpreted: handleInterpreted })

  /** Resultado de una generación o regeneración: el aviso solo si la IA falló. */
  function mostrarResultado(campaign) {
    setResult({
      campaign,
      warning:
        campaign?.estado === 'borrador' && campaign?.ia_error_message
          ? `La generación IA falló: ${campaign.ia_error_message}`
          : null,
    })
  }

  async function onSubmit(formData) {
    if (enviando.current) return
    enviando.current = true
    brief.voz.stop()
    setSubmitting(true)
    setServerError('')
    setNoCredits(false)
    setResult(null)

    try {
      const { data } = intent
        ? await api.post(`/api/intents/${intent.id}/confirm/`, { campos: formData })
        : await api.post('/api/campaigns/', formData)
      mostrarResultado(data.data.campaign)
      // El crédito ya se descontó — que la banda lo refleje al instante
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err) {
      const httpStatus = err.response?.status
      const body = err.response?.data

      if (httpStatus === 400) {
        const errMap = body?.data?.errors ?? {}
        const first = Object.values(errMap)[0]?.[0]
        setServerError(first || 'Revisa los campos marcados.')
      } else if (httpStatus === 402) {
        // Sin créditos → estado dedicado (HU24)
        setNoCredits(true)
      } else if (httpStatus === 409) {
        // La intención ya no es editable (p. ej. se descartó en otro dispositivo)
        setIntent(null)
        setServerError(body?.message || 'Este brief ya no está disponible. Vuelve a generar.')
      } else if (httpStatus === 503) {
        // Campaña guardada como borrador pero IA falló
        setResult({ campaign: body?.data?.campaign, warning: body?.message })
      } else {
        setServerError('El servidor no respondió. Intenta de nuevo en unos segundos.')
      }
    } finally {
      enviando.current = false
      setSubmitting(false)
    }
  }

  // Reintentar regenera la MISMA campaña (que volvió a borrador): nunca crea otra.
  async function reintentar() {
    const id = result?.campaign?.id
    if (!id || enviando.current) return
    enviando.current = true
    setSubmitting(true)
    try {
      const { data } = await api.post(`/api/campaigns/${id}/regenerate/`)
      mostrarResultado(data.data.campaign)
      window.dispatchEvent(new Event('credits-updated'))
    } catch (err) {
      const body = err.response?.data
      if (err.response?.status === 402) {
        setResult(null)
        setNoCredits(true)
      } else {
        setResult({
          campaign: body?.data?.campaign ?? result.campaign,
          warning: body?.message || 'No se pudo reintentar. Abre la campaña desde la lista.',
        })
      }
    } finally {
      enviando.current = false
      setSubmitting(false)
    }
  }

  function handleReset() {
    setResult(null)
    setServerError('')
    setNoCredits(false)
    setIntent(null)
    setResumenIntent(null)
    valoresIa.current = {}
    brief.reiniciar()
    setVista('proxima')
    reset()
  }

  if (noCredits) {
    return (
      <div className="mx-auto max-w-xl">
        {/* Volver conserva el brief y la ficha: sin créditos no se pierde lo dictado. */}
        <CreditsExhausted onClose={() => setNoCredits(false)} />
      </div>
    )
  }
  if (submitting || result?.campaign?.estado === 'pendiente_ia') {
    return <GeneratingState titulo={getValues('titulo')} onCancel={handleReset} />
  }
  if (result?.demora) {
    return (
      <section role="status" className="regla mx-auto max-w-xl pt-6">
        <h2 className="text-[26px] font-extrabold leading-tight text-on-surface">La IA está tardando más de lo normal</h2>
        <p className="mt-2 text-[15px] text-on-surface-variant">
          La generación sigue en el servidor. Abre la campaña en unos minutos para ver el copy y la imagen; si la IA
          falla, se te devuelve el crédito.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink to={`/campaigns/${result.campaign.id}`}>Ver la campaña</ButtonLink>
          <Button variant="outline" onClick={handleReset}>
            Dictar otra
          </Button>
        </div>
      </section>
    )
  }
  if (result?.warning) {
    const intentos = result.campaign?.intentos_generacion
    return (
      <div className="mx-auto max-w-xl">
        <ErrorState
          message={result.warning}
          attempt={intentos ?? 1}
          onRetry={result.campaign?.id ? reintentar : undefined}
          onEditBrief={handleReset}
        />
      </div>
    )
  }

  const estadoCampo = (campo) => {
    if (!resumenIntent) return null
    return resumenIntent.completados.includes(campo) ? 'ia' : 'falta'
  }

  const ocupado = submitting || brief.interpretando
  const listo = brief.texto.trim().length > 0 && !brief.voz.listening
  const proxima = () => (
    <div>
      <h2 className="text-2xl font-extrabold leading-tight text-on-surface">Ficha técnica</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
        Al terminar, la IA la llena con lo que dijiste. Lo que no reconozca queda vacío y te avisa.
      </p>
      <table className="mt-5 w-full text-[15px]">
        <caption className="sr-only">Campos que completará la IA</caption>
        <tbody>
          {CAMPOS.map(({ campo, label }) => (
            <tr key={campo} className="border-t border-hairline">
              <th scope="row" className="py-2.5 text-left font-medium text-on-surface">
                {label}
              </th>
              <td className="py-2.5 text-right text-[13px] text-outline">por completar</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 grid gap-3">
        <Button type="button" size="lg" onClick={brief.interpretar} disabled={!listo || ocupado}>
          {brief.interpretando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-5 w-5" aria-hidden="true" />}
          {brief.interpretando ? 'Completando la ficha…' : 'Completar ficha'}
        </Button>
        <p className="text-[13px] text-on-surface-variant">Completar la ficha no usa créditos. Generar la campaña usa 1.</p>
        <button
          type="button"
          onClick={() => setVista('formulario')}
          disabled={ocupado}
          className="-my-1 inline-flex min-h-11 items-center justify-start text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          Prefiero llenar la ficha a mano
        </button>
      </div>
    </div>
  )

  const formulario = () => (
    <form onSubmit={(e) => handleSubmit(onSubmit)(e)} noValidate className="entra-lenta">
      <h2 className="text-2xl font-extrabold leading-tight text-on-surface">
        Ficha técnica
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-on-surface-variant">
        {resumenIntent
          ? `La IA completó ${resumenIntent.completados.length} de 7 campos. Revísalos y corrige lo que falte antes de generar.`
          : 'Llénala a mano. Generar la campaña usa 1 crédito.'}
      </p>

      {resumenIntent?.advertencias?.length > 0 && (
        <ul className="mt-4 space-y-2">
          {resumenIntent.advertencias.map((aviso, i) => (
            <li key={`${i}-${aviso}`} className="flex items-start gap-2 rounded-[10px] bg-warning-container px-3 py-2.5 text-sm text-on-tertiary-container">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden="true" />
              {aviso}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-4">
        {CAMPOS.map(({ campo, label, ayuda, max }) => {
          const err = errors[campo]?.message
          const errId = `${campo}-error`
          const ayudaId = `${campo}-ayuda`
          const largo = max ? (largos[campo] || '').length : 0
          const comun = {
            id: campo,
            disabled: submitting,
            'aria-invalid': err ? 'true' : undefined,
            'aria-describedby': err ? errId : ayuda ? ayudaId : undefined,
          }
          return (
            <div key={campo}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <label htmlFor={campo} className="text-sm font-medium text-on-surface">
                  {campo === 'cliente_nombre' ? 'Nombre del cliente' : label}
                </label>
                <MarcaCampo estado={estadoCampo(campo)} />
              </div>
              {campo === 'titulo' && (
                <input
                  type="text"
                  placeholder="Ej.: 2×1 en capuchinos los martes"
                  className={inputCls(err)}
                  {...comun}
                  {...register('titulo', {
                    required: 'Escribe un título.',
                    minLength: { value: 5, message: 'Usa al menos 5 caracteres.' },
                    maxLength: { value: 200, message: 'Usa 200 caracteres o menos.' },
                  })}
                />
              )}
              {campo === 'cliente_nombre' && (
                <input
                  type="text"
                  placeholder="Ej.: Café Aurora"
                  className={inputCls(err)}
                  {...comun}
                  {...register('cliente_nombre', {
                    required: 'Escribe el nombre del cliente.',
                    maxLength: { value: 150, message: 'Usa 150 caracteres o menos.' },
                  })}
                />
              )}
              {campo === 'cliente_email' && (
                <input
                  type="email"
                  placeholder="cliente@empresa.com"
                  className={inputCls(err)}
                  {...comun}
                  {...register('cliente_email', {
                    required: 'Escribe el correo del cliente: ahí recibe la campaña para aprobarla.',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ese correo no parece válido.' },
                  })}
                />
              )}
              {campo === 'industria' && (
                <select className={inputCls(err)} {...comun} {...register('industria', { required: 'Elige una industria.' })}>
                  <option value="">Elige una industria</option>
                  {INDUSTRIAS.map(({ value, label: l }) => (
                    <option key={value} value={value}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {campo === 'tono' && (
                <select className={inputCls(err)} {...comun} {...register('tono', { required: 'Elige un tono.' })}>
                  <option value="">Elige un tono</option>
                  {TONOS.map(({ value, label: l }) => (
                    <option key={value} value={value}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {campo === 'plataforma' && (
                <select className={inputCls(err)} {...comun} {...register('plataforma', { required: 'Elige una plataforma.' })}>
                  <option value="">Elige una plataforma</option>
                  {PLATAFORMAS.map(({ value, label: l }) => (
                    <option key={value} value={value}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
              {campo === 'prompt' && (
                <textarea
                  rows={5}
                  placeholder="Ej.: 2×1 para universitarios los martes; destacar el precio; sin nombrar a la competencia."
                  className={cn(inputCls(err), 'h-auto resize-y py-2.5 leading-relaxed')}
                  {...comun}
                  {...register('prompt', {
                    required: 'Escribe las instrucciones para la IA.',
                    minLength: { value: 10, message: 'Usa al menos 10 caracteres.' },
                    maxLength: { value: 2000, message: 'Usa 2000 caracteres o menos.' },
                  })}
                />
              )}
              <div className="mt-1 flex items-start justify-between gap-3">
                {err ? (
                  <FieldError id={errId} message={err} />
                ) : (
                  ayuda && (
                    <p id={ayudaId} className="text-[13px] text-on-surface-variant">
                      {ayuda}
                    </p>
                  )
                )}
                {max && (
                  <span
                    aria-hidden="true"
                    className={cn('ml-auto shrink-0 text-[13px] tabular-nums', largo > max ? 'font-semibold text-error' : 'text-on-surface-variant')}
                  >
                    {largo}/{max}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {serverError && (
        <p role="alert" className="mt-5 rounded-[10px] border border-error/25 bg-error-container px-4 py-3 text-sm text-on-error-container">
          {serverError}
        </p>
      )}

      <div className="mt-6 grid gap-2">
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          <Wand2 className="h-5 w-5" aria-hidden="true" />
          Generar campaña
        </Button>
        <p className="text-center text-[13px] text-on-surface-variant">Usa 1 crédito. Si la IA falla, se devuelve.</p>
        {/* Con un brief ya interpretado, volver deja seguir dictando y completar de nuevo:
            lo corregido a mano se conserva. */}
        <button
          type="button"
          onClick={() => setVista('proxima')}
          disabled={submitting}
          className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          {intent ? 'Seguir dictando y completar de nuevo' : 'Volver a dictar'}
        </button>
      </div>
    </form>
  )

  return (
    <div>
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate('/campaigns')}
          className="-ml-3 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Todas las campañas
        </button>
        <p className="mb-1 text-[13px] text-on-surface-variant">Orden nueva · paso 1 de 5</p>
        <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.025em] text-on-surface sm:text-[40px]">Dicta la campaña</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-on-surface-variant">
          Habla como si se la contaras a tu diseñador. La IA propone los campos y tú los corriges antes de generar.{' '}
          <Link to="/prompt-guide" className="font-semibold text-primary underline underline-offset-2 hover:decoration-2">
            <Lightbulb className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
            Ver la guía
          </Link>
        </p>
      </div>

      <div className="grid gap-12 border-t border-outline-variant pt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-0">
        <div className="min-w-0 lg:pr-10">
          <VoiceBriefCard brief={brief} disabled={submitting} />
        </div>
        <aside aria-label="Ficha técnica" className="min-w-0 lg:border-l lg:border-outline-variant lg:pl-8">
          {vista === 'formulario' ? formulario() : proxima()}
        </aside>
      </div>
    </div>
  )
}
