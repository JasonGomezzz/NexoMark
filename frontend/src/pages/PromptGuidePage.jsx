import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Share2,
  Mail,
  FileText,
  Lightbulb,
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
    titulo: 'Redes Sociales',
    texto:
      'Crea un caption de alta energía para Instagram sobre el lanzamiento de nuestro producto. Incluye un llamado a la acción claro y 3 hashtags relevantes al rubro.',
  },
  {
    icon: Mail,
    titulo: 'Email',
    texto:
      'Redacta un email personalizado de re-enganche para clientes que abandonaron su carrito, con tono cercano, un beneficio concreto y un solo botón de acción.',
  },
  {
    icon: FileText,
    titulo: 'Anuncio pagado',
    texto:
      'Escribe 3 variantes de un anuncio de búsqueda de Google para un servicio B2B: titular de máximo 30 caracteres, descripción de máximo 90 y enfoque en el dolor del cliente.',
  },
  {
    icon: Share2,
    titulo: 'LinkedIn B2B',
    texto:
      'Escribe un post de LinkedIn con tono profesional que nos posicione como líderes del sector: un dato duro de apertura, 3 aprendizajes accionables y una pregunta final para generar conversación.',
  },
  {
    icon: Mail,
    titulo: 'Lanzamiento',
    texto:
      'Anuncia el lanzamiento de una nueva línea de productos a clientes existentes: acceso anticipado de 48 horas, 2 beneficios exclusivos y un solo llamado a la acción.',
  },
  {
    icon: FileText,
    titulo: 'Oferta flash',
    texto:
      'Copy urgente para una promoción de 24 horas: descuento del 30%, tono directo y enérgico, sensación de escasez real (stock limitado) y llamado a la acción imposible de ignorar.',
  },
  {
    icon: Share2,
    titulo: 'Storytelling de marca',
    texto:
      'Cuenta la historia de origen de la marca en carrusel de Instagram (5 slides): problema que vimos, por qué nos importó, cómo lo resolvemos, prueba social y cierre con invitación a la comunidad.',
  },
  {
    icon: Mail,
    titulo: 'Reactivación',
    texto:
      'Email para clientes inactivos hace 90 días, tono cercano y sin culpas: recuérdales el valor que obtuvieron, muestra una novedad relevante y ofrece un incentivo simple para volver.',
  },
  {
    icon: FileText,
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
    desc: 'No esperes perfección al primer intento: usa Regenerar (4 créditos) con un brief ajustado.',
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
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Guía de prompts</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Un buen brief produce mejor copy e imagen. Usa un ejemplo o arma tu brief y
            llévalo directo a una campaña nueva.
          </p>
        </header>

        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-8">
            {/* Templates */}
            <section className="regla pt-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-extrabold text-on-surface">Briefs de ejemplo</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTemplates(sampleTemplates())
                    setCopiedIdx(null)
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Ver otros ejemplos
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3">
                {templates.map((t, idx) => {
                  const Icon = t.icon
                  return (
                    <article
                      key={t.titulo}
                      className={`flex flex-col py-5 md:pr-6 ${idx > 0 ? 'border-t border-hairline md:border-l md:border-t-0 md:pl-6' : ''}`}
                    >
                      <h3 className="mb-2 flex items-center gap-2 text-base font-extrabold text-on-surface">
                        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                        {t.titulo}
                      </h3>
                      <p className="mb-4 flex-1 font-display text-[17px] font-medium leading-snug text-on-surface">
                        «{t.texto}»
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" onClick={() => usarEnNuevaCampana(t.texto)}>
                          Usar en nueva campaña
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copiarTemplate(t.texto, idx)}
                        >
                          {copiedIdx === idx ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
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
            <section className="regla pt-6">
              <h2 className="mb-1 flex items-center gap-2 text-2xl font-extrabold text-on-surface">
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
                    className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
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
                    className="h-11 w-full rounded-[10px] border border-outline bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/30"
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
                  className="w-full resize-y rounded-[10px] border border-outline bg-surface-container-lowest px-3 py-2.5 text-[15px] text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/30"
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
                      className={`inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        tono === t
                          ? 'bg-primary text-on-primary'
                          : 'border border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vista previa del brief */}
              <div className="mt-6 border-l-2 border-turquoise pl-4">
                <p className="mb-1 text-[13px] font-semibold text-on-surface-variant">
                  Así queda el brief
                </p>
                <p className="font-display text-[19px] font-medium leading-snug text-on-surface">{promptListo}</p>
              </div>

              <Button
                className="mt-5"
                disabled={!builderValido}
                onClick={() => usarEnNuevaCampana(promptListo, tono)}
              >
                Usar en nueva campaña
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
            <div className="regla pt-6 xl:border-t-0 xl:border-l xl:border-outline-variant xl:pl-8 xl:pt-0">
              <h2 className="mb-5 flex items-center gap-2 text-xl font-extrabold text-on-surface">
                <Lightbulb className="h-5 w-5 text-primary" aria-hidden="true" />
                Consejos
              </h2>
              <ol className="space-y-5">
                {TIPS.map((tip, i) => (
                  <li key={tip.titulo} className="flex gap-3">
                    <span className="casilla casilla-pliego h-7 w-7 shrink-0 text-[13px] font-bold text-on-surface" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-[15px] font-bold text-on-surface">{tip.titulo}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-on-surface-variant">
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
