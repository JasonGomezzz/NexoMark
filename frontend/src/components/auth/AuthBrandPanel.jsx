import { motion } from 'motion/react'
import { ChartColumn, CheckCheck, Info, Mic, Send, Wand2 } from 'lucide-react'
import NexoN from '@/components/NexoN'

/**
 * Panel de marca compartido por Login y Register (dirección "Conforme"): la
 * N encaja al entrar y debajo va la orden de trabajo real del producto, cinco
 * casillas, cada una con lo que hace de verdad.
 * El testimonio viene de /api/auth/brand-content/ y va rotulado como ejemplo
 * (no es un cliente real); sin foto, con iniciales.
 * `highlights` los provee cada pantalla; `demo: true` marca un dato de ejemplo.
 */
const ESTACIONES = [
  { nombre: 'Dictar', icono: Mic, desc: 'Hablas la idea en el navegador o en la app. A NexoMark solo llega el texto.' },
  { nombre: 'Generar', icono: Wand2, desc: 'La IA propone los campos y crea copy e imagen. Cada generación usa 4 créditos.' },
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
    // Pegado a la ventana (alto exacto, sin scroll propio): si el formulario de al lado es
    // largo, la página se desplaza y el panel se queda. Lo que no cabe se compacta por alto
    // con las variantes alto-medio / alto-corto / alto-minimo (index.css).
    <aside className="sticky top-0 hidden h-dvh w-[46%] max-w-[680px] shrink-0 flex-col justify-between gap-8 self-start overflow-hidden bg-cama px-12 py-12 text-on-navy md:flex lg:px-16 alto-medio:gap-6 alto-medio:py-8">
      <div>
        <NexoN encajar retraso={0.15} className="h-14 w-14 alto-corto:h-11 alto-corto:w-11" titulo="NexoMark IA" />
        <motion.p
          initial={{ opacity: 0, transform: 'translateY(8px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
          className="mt-8 max-w-md font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance alto-medio:mt-6 alto-corto:mt-4 alto-corto:text-[2.1rem]"
        >
          De la idea dictada al post publicado.
        </motion.p>
      </div>

      <ol className="max-w-md divide-y divide-cama-line border-y border-cama-line" aria-label="Orden de trabajo de una campaña">
        {ESTACIONES.map(({ nombre, icono: Icono, desc }, index) => (
          <li key={nombre} className="grid grid-cols-[36px_1fr] items-start gap-4 py-4 alto-medio:py-3 alto-corto:py-2.5">
            <span className={`casilla mt-0.5 h-9 w-9 ${index === 0 ? 'casilla-actual' : ''}`} aria-hidden="true">
              <Icono className="h-[18px] w-[18px]" strokeWidth={index === 0 ? 2.25 : 1.75} />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold leading-tight">{nombre}</p>
              {/* En ventanas bajas solo se conserva la descripción del primer paso. */}
              <p
                className={`mt-1 text-[15px] leading-relaxed text-on-navy-muted ${index === 0 ? 'alto-corto:hidden' : 'alto-medio:hidden'}`}
              >
                {desc}
              </p>
              {nombre === 'Generar' &&
                ejemplos.map(({ titulo }) => (
                  <p key={titulo} className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-on-navy alto-corto:hidden">
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

      <figure className="relative max-w-md pt-2 alto-minimo:hidden">
        <span className="demo-tag demo-tag-on-navy">
          <Info className="h-3 w-3" aria-hidden="true" />
          Testimonio de ejemplo, no es un cliente real
        </span>
        <blockquote className="mt-4 text-[17px] font-medium leading-relaxed alto-corto:mt-3 alto-corto:text-base">«{quote}»</blockquote>
        <figcaption className="mt-4 flex items-center gap-3 alto-corto:mt-3">
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
