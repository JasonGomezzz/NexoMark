import { motion, useReducedMotion } from 'motion/react'
import { Check, CircleCheck, History, Info, Mic, RefreshCw, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import featureImage from '@/assets/landing/feature-image.webp'
import instagramLogo from '@/assets/social/instagram.png'
import facebookLogo from '@/assets/social/facebook.png'

/**
 * Funciones que ya existen, cada una con un fragmento de la interfaz real
 * construido en HTML (data-ui). Los fragmentos alternan arriba/abajo para que
 * la cuadrícula no sea una fila de tarjetas iguales.
 */
function Fragment({ children, className }) {
  return (
    <div data-ui className={cn('rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm', className)}>
      {children}
    </div>
  )
}

const FEATURES = [
  {
    titulo: 'Dictado en el navegador',
    texto: 'Pulsa el micrófono y describe la campaña. El texto aparece mientras hablas y puedes corregirlo antes de enviarlo.',
    fragment: (
      <Fragment>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error text-on-error">
            <Mic className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-semibold text-on-surface">Escuchando…</span>
        </div>
        <p className="mt-3 rounded-lg bg-surface-container-low px-3 py-2.5 leading-relaxed text-on-surface">
          Campaña para la cafetería, promo 2x1 del sábado, tono cercano
          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary" aria-hidden="true" />
        </p>
      </Fragment>
    ),
  },
  {
    titulo: 'Copy e imagen con IA',
    texto: 'Gemini redacta el texto y genera la imagen del anuncio. Regenerar cuesta un crédito; mejorar el texto, nada.',
    fragment: (
      <Fragment className="flex flex-col gap-3">
        <div className="flex gap-3">
          <img src={featureImage} alt="Botella cobre sobre agua turquesa, imagen generada con IA" width="80" height="80" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
          <p className="min-w-0 leading-relaxed text-on-surface">Hidratación que se nota. La nueva fórmula llega este mes.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-md border border-outline px-2.5 py-1 text-[13px] font-semibold text-on-surface">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Regenerar · 1&nbsp;crédito
        </span>
      </Fragment>
    ),
  },
  {
    titulo: 'Historial de versiones',
    texto: 'Cada edición queda guardada. Compara dos versiones lado a lado y restaura la que prefieras; se conservan las últimas cinco.',
    fragment: (
      <Fragment className="space-y-1.5">
        {[
          { v: 'Versión 3', note: 'Actual', current: true },
          { v: 'Versión 2', note: 'Restaurar' },
          { v: 'Versión 1', note: 'Restaurar' },
        ].map((row) => (
          <div
            key={row.v}
            className={cn('flex items-center justify-between rounded-lg px-3 py-2', row.current ? 'bg-primary-fixed' : 'bg-surface-container-low')}
          >
            <span className="flex items-center gap-2 font-medium text-on-surface">
              <History className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
              {row.v}
            </span>
            <span className={cn('text-[13px] font-semibold', row.current ? 'text-on-primary-fixed' : 'text-primary')}>{row.note}</span>
          </div>
        ))}
      </Fragment>
    ),
  },
  {
    titulo: 'Aprobación del cliente',
    texto: 'El cliente aprueba o rechaza con una valoración y un comentario. Lo que aprueba es exactamente lo que se publica.',
    fragment: (
      <Fragment>
        <p className="font-semibold text-on-surface">¿Apruebas esta versión?</p>
        <div className="mt-2 flex gap-1 text-tertiary" aria-label="Valoración de 4 de 5">
          {[0, 1, 2, 3, 4].map((n) => (
            <Star key={n} className={cn('h-5 w-5', n < 4 ? 'fill-current' : 'text-outline')} aria-hidden="true" />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline px-3 py-2 font-semibold text-on-surface">
            <X className="h-4 w-4" aria-hidden="true" /> Rechazar
          </span>
          <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 font-semibold text-on-success">
            <CircleCheck className="h-4 w-4" aria-hidden="true" /> Aprobar
          </span>
        </div>
      </Fragment>
    ),
  },
  {
    titulo: 'Destinos al enviar',
    texto: 'El marketero elige en qué cuentas sale y el cliente ve «se publicará en» antes de aprobar. Las cuentas se conectan con el login de Meta.',
    fragment: (
      <Fragment className="space-y-2">
        {[
          { logo: instagramLogo, red: 'Instagram', cuenta: '@nexomarkia', on: true },
          { logo: facebookLogo, red: 'Facebook', cuenta: 'Café Aurora', on: false },
        ].map((d) => (
          <div key={d.red} className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2.5">
            <img src={d.logo} alt="" width="24" height="24" className="h-6 w-6" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-on-surface">{d.cuenta}</span>
              <span className="block text-[13px] text-on-surface-variant">{d.red}</span>
            </span>
            <span
              className={cn('flex h-5 w-5 items-center justify-center rounded border', d.on ? 'border-primary bg-primary text-on-primary' : 'border-outline')}
              aria-hidden="true"
            >
              {d.on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
          </div>
        ))}
      </Fragment>
    ),
  },
  {
    titulo: 'Estadísticas honestas',
    texto: 'Me gusta, comentarios, alcance y vistas de cada publicación, por red y por mes. Si Meta no informa un dato, se muestra «sin dato».',
    fragment: (
      <Fragment>
        <span className="demo-tag">
          <Info className="h-3 w-3" aria-hidden="true" />
          Valores de ejemplo
        </span>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[
            { k: 'Me gusta', v: '24' },
            { k: 'Comentarios', v: '3' },
            { k: 'Alcance', v: 'sin dato', muted: true },
          ].map((m) => (
            <div key={m.k} className="rounded-lg bg-surface-container-low px-3 py-2.5">
              <dt className="text-[13px] text-on-surface-variant">{m.k}</dt>
              <dd className={cn('mt-0.5 font-bold tabular-nums', m.muted ? 'text-[15px] text-on-surface-variant' : 'text-xl text-on-surface')}>{m.v}</dd>
            </div>
          ))}
        </dl>
      </Fragment>
    ),
  },
]

export default function FeaturesBento() {
  // Con "reducir movimiento" el contenido nace en su estado final (antes quedaba invisible).
  const sinMovimiento = useReducedMotion()
  return (
    <section id="funciones" aria-labelledby="funciones-title" className="scroll-mt-16 bg-surface-container-low px-2 py-24 sm:px-3 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <h2
          id="funciones-title"
          className="px-2 text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-on-surface sm:px-3 lg:px-8"
        >
          Lo que ya funciona
        </h2>
        <p className="mt-4 px-2 text-base text-on-surface-variant sm:px-3 lg:px-8">
          Fragmentos de la interfaz con contenido de ejemplo.
        </p>
        <div className="mt-12 grid gap-x-8 gap-y-6 px-2 sm:px-3 md:grid-cols-2 lg:mt-16 lg:px-8 xl:grid-cols-4">
          {FEATURES.map((f, i) => {
            const fragmentFirst = i % 2 === 1
            const wide = i === 0 || i === FEATURES.length - 1
            return (
              <motion.article
                key={f.titulo}
                initial={sinMovimiento ? false : { opacity: 0, transform: 'translateY(16px)' }}
                whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.07, ease: [0.23, 1, 0.32, 1] }}
                className={cn(
                  'regla flex min-h-[20rem] flex-col justify-between gap-8 px-2 pb-8 pt-6 sm:px-3',
                  fragmentFirst && 'md:flex-col-reverse',
                  wide && 'md:col-span-2 md:min-h-0 md:flex-row md:items-center md:[&>*]:flex-1',
                )}
              >
                <div>
                  <h3 className="text-xl font-extrabold tracking-[-0.01em] text-on-surface">{f.titulo}</h3>
                  <p className="mt-2 max-w-[38ch] text-base leading-relaxed text-on-surface-variant">{f.texto}</p>
                </div>
                {f.fragment}
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
