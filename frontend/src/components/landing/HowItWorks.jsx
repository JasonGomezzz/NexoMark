import { motion, useReducedMotion } from 'motion/react'

/**
 * "Cómo funciona": el recorrido real, paso por paso, con lo que garantiza cada
 * uno. La barra turquesa crece con el avance (la pieza turquesa de la N).
 */
const STEPS = [
  {
    verbo: 'Dicta',
    texto: 'Habla en Chrome, Edge o la app Android. A NexoMark llega solo el texto: el audio no se guarda.',
  },
  {
    verbo: 'Revisa',
    texto: 'La IA propone título, tono, plataforma y público. Corriges lo que quieras; interpretar no gasta créditos.',
  },
  {
    verbo: 'Genera',
    texto: 'Gemini escribe el copy y crea la imagen. Cuesta 1 crédito y, si la generación falla, se devuelve.',
  },
  {
    verbo: 'Aprueba',
    texto: 'Tu cliente ve la versión exacta y dónde se publicará. La aprueba o la rechaza con un comentario.',
  },
  {
    verbo: 'Publica y mide',
    texto: 'Al aprobar, se publica sola en Instagram y Facebook. Si Meta aún no da una métrica, verás «sin dato», nunca un cero.',
  },
]

export default function HowItWorks() {
  // Con "reducir movimiento" el contenido nace en su estado final (antes quedaba invisible).
  const sinMovimiento = useReducedMotion()
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="scroll-mt-16 px-4 py-24 sm:px-6 lg:px-10 lg:py-36">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-6 lg:grid-cols-12">
          <h2
            id="como-funciona-title"
            className="text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-on-surface lg:col-span-5"
          >
            Un solo flujo, de la voz a las métricas
          </h2>
          <p className="max-w-[34rem] text-lg leading-relaxed text-on-surface lg:col-span-6 lg:col-start-7 lg:pt-2">
            Las herramientas de redes publican y miden. NexoMark además crea la campaña desde tu voz y ata la
            publicación a la aprobación del cliente.
          </p>
        </div>

        <ol className="relative mt-16 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-24 lg:grid-cols-5">
          {/* La vía que une las cinco estaciones (escritorio) */}
          <span aria-hidden="true" className="absolute left-[18px] right-[calc(20%-18px)] top-[18px] hidden h-1.5 -translate-y-1/2 rounded-full bg-turquoise lg:block" />
          {STEPS.map((step, i) => (
            <motion.li
              key={step.verbo}
              initial={sinMovimiento ? false : { opacity: 0, transform: 'translateY(16px)' }}
              whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] }}
            >
              <span
                aria-hidden="true"
                className={`relative z-10 block h-9 w-9 rounded-full ${i === 0 ? 'bg-turquoise shadow-[0_0_0_4px_var(--color-background),0_0_0_6px_var(--color-turquoise-soft)]' : 'border-[5px] border-turquoise bg-background'}`}
              />
              <h3 className="mt-6 text-2xl font-extrabold tracking-[-0.02em] text-on-surface">{step.verbo}</h3>
              <p className="mt-3 text-base leading-relaxed text-on-surface-variant">{step.texto}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
