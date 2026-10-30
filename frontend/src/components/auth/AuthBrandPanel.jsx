import { motion } from 'motion/react'
import { ChartColumn, CheckCheck, Info, Mic, Send, Wand2 } from 'lucide-react'
import NexoN from '@/components/NexoN'

/**
 * Panel de marca compartido por Login y Register (dirección "Línea"): la N
 * encaja al entrar y debajo corre el recorrido real del producto como una
 * línea vertical de cinco estaciones, cada una con lo que hace de verdad.
 * El testimonio viene de /api/auth/brand-content/ y va rotulado como ejemplo
 * (no es un cliente real); sin foto, con iniciales.
 * `highlights` los provee cada pantalla; `demo: true` marca un dato de ejemplo.
 */
const ESTACIONES = [
  { nombre: 'Dictar', icono: Mic, desc: 'Hablas la idea en el navegador o en la app. A NexoMark solo llega el texto.' },
  { nombre: 'Generar', icono: Wand2, desc: 'La IA propone los campos y crea copy e imagen. Cada generación usa 1 crédito.' },
  { nombre: 'Aprobar', icono: CheckCheck, desc: 'Tu cliente aprueba la versión exacta que saldrá en sus redes.' },
  { nombre: 'Publicar', icono: Send, desc: 'Al aprobarla, se publica sola en Instagram o Facebook.' },
  { nombre: 'Medir', icono: ChartColumn, desc: 'Ves me gusta, comentarios y alcance. Lo que Meta no informa dice «sin dato».' },
]

export default function AuthBrandPanel({
  highlights = [],
  quote = 'NexoMark transformó nuestra estrategia digital. Lo que antes nos tomaba una semana, ahora lo resolvemos en una mañana.',
  personName = 'Elena Rodríguez',
  personRole = 'Directora de Marketing, Global Creative Co.',
}) {
  const iniciales = personName
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const ejemplos = highlights.filter((h) => h.demo)

  return (
    <aside className="relative hidden min-h-screen w-[46%] max-w-[680px] shrink-0 flex-col gap-10 overflow-hidden bg-banda px-12 py-12 text-on-navy md:flex lg:px-16">
      <div>
        <NexoN encajar retraso={0.15} className="h-14 w-14" titulo="NexoMark IA" />
        <motion.p
          initial={{ opacity: 0, transform: 'translateY(8px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
          className="mt-8 max-w-md font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance"
        >
          De la idea dictada al post publicado.
        </motion.p>
      </div>

      <ol className="relative max-w-md" aria-label="Recorrido de una campaña">
        <span className="absolute bottom-6 left-[15px] top-4 w-1.5 rounded-full bg-via" aria-hidden="true" />
        {ESTACIONES.map(({ nombre, icono: Icono, desc }, index) => (
          <li key={nombre} className="relative grid grid-cols-[36px_1fr] gap-4 pb-6 last:pb-0">
            {index === 0 ? (
              <span className="relative z-10 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-turquoise text-navy-deep shadow-[0_0_0_4px_var(--color-banda),0_0_0_6px_var(--color-turquoise-soft)]">
                <Icono className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
              </span>
            ) : (
              <span className="relative z-10 mx-auto mt-2 h-5 w-5 rounded-full border-4 border-on-navy-muted bg-banda" aria-hidden="true" />
            )}
            <div>
              <p className="font-display text-lg font-extrabold leading-tight">{nombre}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-on-navy-muted">{desc}</p>
              {nombre === 'Generar' &&
                ejemplos.map(({ titulo }) => (
                  <p key={titulo} className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-on-navy">
                    {titulo}
                    <span className="demo-tag demo-tag-on-navy">
                      <Info className="h-3 w-3" aria-hidden="true" />
                      Dato de ejemplo
                    </span>
                  </p>
                ))}
            </div>
          </li>
        ))}
      </ol>

      <figure className="relative mt-auto max-w-md border-t border-via pt-6">
        <span className="demo-tag demo-tag-on-navy">
          <Info className="h-3 w-3" aria-hidden="true" />
          Testimonio de ejemplo, no es un cliente real
        </span>
        <blockquote className="mt-4 text-[17px] font-medium leading-relaxed">«{quote}»</blockquote>
        <figcaption className="mt-4 flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-banda-2 text-sm font-bold text-on-navy"
            aria-hidden="true"
          >
            {iniciales}
          </span>
          <span>
            <span className="block text-sm font-semibold">{personName}</span>
            <span className="block text-[13px] text-on-navy-muted">{personRole}</span>
          </span>
        </figcaption>
      </figure>
    </aside>
  )
}
