import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2,
  Mail,
  FileText,
  Lightbulb,
  Sparkles,
  ArrowRight,
  ClipboardCopy,
  Check,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { Button } from '@/components/ui/button'

/**
 * Guía de prompts IA (portado de Stitch: ai_prompt_guide). Página 100% client-side:
 * templates + tips + builder que COMPONE el texto del brief y lo lleva prellenado
 * a /campaigns/new (via state del router). No llama a IA ni consume créditos —
 * la generación real ocurre al crear la campaña.
 */
// Pool de templates: cada carga muestra 3 al azar y "Ver otros ejemplos"
// baraja sin recargar la página.
const TEMPLATE_POOL = [
  {
    icon: Share2,
    tint: 'bg-primary/10 text-primary',
    titulo: 'Redes Sociales',
    texto:
      'Crea un caption de alta energía para Instagram sobre el lanzamiento de nuestro producto. Incluye un llamado a la acción claro y 3 hashtags relevantes al rubro.',
  },
  {
    icon: Mail,
    tint: 'bg-tertiary-container text-tertiary',
    titulo: 'Email',
    texto:
      'Redacta un email personalizado de re-enganche para clientes que abandonaron su carrito, con tono cercano, un beneficio concreto y un solo botón de acción.',
  },
  {
    icon: FileText,
    tint: 'bg-secondary-container text-primary',
    titulo: 'Anuncio pagado',
    texto:
      'Escribe 3 variantes de un anuncio de búsqueda de Google para un servicio B2B: titular de máximo 30 caracteres, descripción de máximo 90 y enfoque en el dolor del cliente.',
  },
  {
    icon: Share2,
    tint: 'bg-primary/10 text-primary',
    titulo: 'LinkedIn B2B',
    texto:
      'Escribe un post de LinkedIn con tono profesional que nos posicione como líderes del sector: un dato duro de apertura, 3 aprendizajes accionables y una pregunta final para generar conversación.',
  },
  {
    icon: Mail,
    tint: 'bg-tertiary-container text-tertiary',
    titulo: 'Lanzamiento',
    texto:
      'Anuncia el lanzamiento de una nueva línea de productos a clientes existentes: acceso anticipado de 48 horas, 2 beneficios exclusivos y un solo llamado a la acción.',
  },
  {
    icon: FileText,
    tint: 'bg-secondary-container text-primary',
    titulo: 'Oferta flash',
    texto:
      'Copy urgente para una promoción de 24 horas: descuento del 30%, tono directo y enérgico, sensación de escasez real (stock limitado) y llamado a la acción imposible de ignorar.',
  },
  {
    icon: Share2,
    tint: 'bg-primary/10 text-primary',
    titulo: 'Storytelling de marca',
    texto:
      'Cuenta la historia de origen de la marca en carrusel de Instagram (5 slides): problema que vimos, por qué nos importó, cómo lo resolvemos, prueba social y cierre con invitación a la comunidad.',
  },
  {
    icon: Mail,
    tint: 'bg-tertiary-container text-tertiary',
    titulo: 'Reactivación',
    texto:
      'Email para clientes inactivos hace 90 días, tono cercano y sin culpas: recuérdales el valor que obtuvieron, muestra una novedad relevante y ofrece un incentivo simple para volver.',
  },
  {
    icon: FileText,
    tint: 'bg-secondary-container text-primary',
    titulo: 'Testimonio en anuncio',
    texto:
      'Convierte un testimonio real de cliente en anuncio de Facebook: cita corta como gancho, el problema resuelto en 2 líneas y llamado a la acción hacia la prueba gratuita.',
  },
]

/** Devuelve 3 templates al azar del pool (sin repetir). */
function sampleTemplates() {
  return [...TEMPLATE_POOL].sort(() => Math.random() - 0.5).slice(0, 3)
}

const TIPS = [
  {
    titulo: 'Sé específico con las restricciones',
    desc: 'Menciona límites de caracteres, palabras a evitar o menciones obligatorias de la marca.',
  },
  {
    titulo: 'Menciona la plataforma',
    desc: 'La IA escribe distinto para LinkedIn que para Instagram. El campo plataforma del formulario ya se lo indica.',
  },
  {
    titulo: 'Refina por iteración',
    desc: 'No esperes perfección al primer intento: usa Regenerar (1 crédito) con un brief ajustado.',
  },
]

const OBJETIVOS = [
  'Conversión (ventas)',
  'Reconocimiento de marca',
  'Tráfico al sitio web',
  'Fidelización de clientes',
]

// Mismos valores del formulario real (CampaignTono del backend)
const TONOS = ['profesional', 'casual', 'urgente', 'inspiracional', 'humoristico']

export default function PromptGuidePage() {
  const navigate = useNavigate()
  const [objetivo, setObjetivo] = useState(OBJETIVOS[0])
  const [audiencia, setAudiencia] = useState('')
  const [beneficios, setBeneficios] = useState('')
  const [tono, setTono] = useState('profesional')
  const [copiedIdx, setCopiedIdx] = useState(null)
  const [templates, setTemplates] = useState(sampleTemplates)

  function buildPrompt() {
    const partes = [
      `Objetivo de la campaña: ${objetivo}.`,
      audiencia.trim() && `Audiencia objetivo: ${audiencia.trim()}.`,
      beneficios.trim() && `Beneficios clave / propuesta de valor: ${beneficios.trim()}.`,
      `Tono deseado: ${tono}.`,
    ]
    return partes.filter(Boolean).join(' ')
  }

  function usarEnNuevaCampana(prompt, tonoSugerido) {
    navigate('/campaigns/new', { state: { prompt, tono: tonoSugerido } })
  }

  async function copiarTemplate(texto, idx) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiedIdx(idx)
      toast.success('Template copiado')
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const promptListo = buildPrompt()
  const builderValido = audiencia.trim().length > 0 || beneficios.trim().length > 0

  return (
    <>
      <AppToaster />
      <div className="space-y-8">
        <header className="max-w-2xl">
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Guía de prompts IA</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Un buen brief produce mejor copy e imagen. Usa los templates o arma tu brief
            estructurado y llévalo directo al formulario de nueva campaña.
          </p>
        </header>

        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-8">
            {/* Templates */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-on-surface">Templates de ejemplo</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTemplates(sampleTemplates())
                    setCopiedIdx(null)
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Ver otros ejemplos
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {templates.map((t, idx) => {
                  const Icon = t.icon
                  return (
                    <article
                      key={t.titulo}
                      className="flex flex-col rounded-xl border border-outline-variant bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
                    >
                      <span className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${t.tint}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mb-1 text-sm font-bold text-on-surface">{t.titulo}</h3>
                      <p className="mb-4 flex-1 text-[13px] italic leading-relaxed text-on-surface-variant">
                        «{t.texto}»
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" onClick={() => usarEnNuevaCampana(t.texto)}>
                          Usar en nueva campaña
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copiarTemplate(t.texto, idx)}
                        >
                          {copiedIdx === idx ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <ClipboardCopy className="h-3.5 w-3.5" />
                          )}
                          {copiedIdx === idx ? 'Copiado' : 'Copiar'}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Builder estructurado */}
            <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-on-surface">
                <Sparkles className="h-5 w-5 text-primary" />
                Constructor de brief
              </h2>
              <p className="mb-6 text-sm text-on-surface-variant">
                Compón el brief aquí (no consume créditos) y pásalo prellenado al formulario.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-on-surface">
                    Objetivo de la campaña
                  </span>
                  <select
                    value={objetivo}
                    onChange={(e) => setObjetivo(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant bg-white px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary"
                  >
                    {OBJETIVOS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-on-surface">
                    Audiencia objetivo
                  </span>
                  <input
                    type="text"
                    value={audiencia}
                    onChange={(e) => setAudiencia(e.target.value)}
                    placeholder="p. ej., profesionales tech, 25-40 años"
                    className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-medium text-on-surface">
                  Beneficios clave / propuesta de valor
                </span>
                <textarea
                  rows={3}
                  value={beneficios}
                  onChange={(e) => setBeneficios(e.target.value)}
                  placeholder="¿Qué hace único a tu producto? Lista los 3 beneficios principales…"
                  className="w-full resize-y rounded-lg border border-outline-variant px-3 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </label>

              <div className="mt-4">
                <span className="mb-2 block text-sm font-medium text-on-surface">Tono deseado</span>
                <div className="flex flex-wrap gap-2">
                  {TONOS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTono(t)}
                      aria-pressed={tono === t}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                        tono === t
                          ? 'bg-primary text-on-primary'
                          : 'border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vista previa del brief */}
              <div className="mt-5 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
                <p className="mb-1 text-[13px] font-bold text-on-surface-variant">
                  Vista previa del brief
                </p>
                <p className="text-sm leading-relaxed text-on-surface">{promptListo}</p>
              </div>

              <Button
                className="mt-5"
                disabled={!builderValido}
                onClick={() => usarEnNuevaCampana(promptListo, tono)}
              >
                <Sparkles className="h-4 w-4" />
                Usar en nueva campaña
                <ArrowRight className="h-4 w-4" />
              </Button>
              {!builderValido && (
                <p className="mt-2 text-[13px] text-on-surface-variant">
                  Completa la audiencia o los beneficios para habilitar el botón.
                </p>
              )}
            </section>
          </div>

          {/* Pro tips */}
          <aside className="w-full shrink-0 xl:sticky xl:top-6 xl:w-80">
            <div className="glass-soft glass-float rounded-xl p-6">
              <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-on-surface">
                <Lightbulb className="h-5 w-5 text-tertiary" />
                Pro tips
              </h2>
              <ol className="space-y-5">
                {TIPS.map((tip, i) => (
                  <li key={tip.titulo} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-[13px] font-bold text-tertiary">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-on-surface">{tip.titulo}</h3>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-on-surface-variant">
                        {tip.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
