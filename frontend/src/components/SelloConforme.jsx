import { motion } from 'motion/react'
import NexoN from '@/components/NexoN'
import { cn } from '@/lib/utils'

/**
 * Sello «conforme» (dirección "Conforme"): la marca con la que el cliente
 * aprueba. Lleva la N (las dos piezas: quien crea y quien aprueba) y la versión
 * aprobada. Con `estampar`, cae sobre la pieza (escala 1.12 → 1, giro −8° → −4°,
 * opacidad) y la N encaja dentro: es el momento firma de la aprobación, una vez,
 * 420 ms. Con "reducir movimiento" aparece ya puesto (MotionConfig en App.jsx).
 */
export default function SelloConforme({ version, tamano = 58, className = '', estampar = false, retraso = 0, etiqueta = 'conforme' }) {
  const texto = version ? `v${version}` : etiqueta
  const n = Math.round(tamano * 0.36)
  return (
    <motion.span
      role="img"
      aria-label={version ? `Aprobada, versión ${version}` : 'Aprobada'}
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full bg-background text-primary', className)}
      style={{ width: tamano, height: tamano }}
      initial={estampar ? { opacity: 0, scale: 1.12, rotate: -8 } : false}
      animate={{ opacity: 1, scale: 1, rotate: -4 }}
      transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1], delay: retraso }}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <span className="relative flex flex-col items-center leading-none" aria-hidden="true">
        <span style={{ width: n, height: n }} className="block">
          <NexoN encajar={estampar} retraso={retraso + 0.12} claro="var(--color-primary)" className="h-full w-full" />
        </span>
        <span className="mt-0.5 font-display font-extrabold" style={{ fontSize: Math.max(8, Math.round(tamano * 0.16)) }}>
          {texto}
        </span>
      </span>
    </motion.span>
  )
}
