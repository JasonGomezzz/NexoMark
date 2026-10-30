import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * La N de NexoMark como dos piezas vectoriales que encajan: la clara (quien
 * crea la campaña) y la turquesa (quien la aprueba). Misma geometría que el
 * maestro `brand/nexomark-icon-approved-1024.png` y que el widget de Flutter
 * (`mobile_flutter/lib/widgets/nexo_mark_logo.dart`).
 *
 * `encajar`: las piezas llegan separadas a lo largo de la diagonal y encajan
 * una vez (420 ms). Es uno de los dos momentos firma; con "reducir movimiento"
 * aparecen ya encajadas (MotionConfig reducedMotion="user" en App.jsx).
 */
const PIEZA_CREA =
  'M240 264 L376 264 L532.2 472.3 L510.6 488.5 L528.6 512.5 L507.8 528.1 L489.8 504.1 L468.2 520.3 L408 440 L408 760 L240 760 Z'
const PIEZA_APRUEBA =
  'M540.8 483.7 L530.4 491.4 L548.4 515.3 L505 547.9 L487.1 523.9 L476.8 531.7 L648 760 L784 760 L784 264 L616 264 L616 584 Z'

// Recorrido de cada pieza al separarse, a lo largo de la diagonal (3:4).
const SEPARACION = 64
const DX = 0.6 * SEPARACION
const DY = 0.8 * SEPARACION

export default function NexoN({
  className = '',
  claro = 'var(--color-on-navy)',
  turquesa = 'var(--color-turquoise)',
  encajar = false,
  retraso = 0,
  titulo,
}) {
  const transicion = { duration: 0.42, ease: [0.23, 1, 0.32, 1], delay: retraso }
  return (
    <svg
      viewBox="232 256 560 512"
      className={cn('overflow-visible', className)}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : 'true'}
    >
      <motion.path
        d={PIEZA_CREA}
        fill={claro}
        initial={encajar ? { x: -DX, y: -DY, opacity: 0.6 } : false}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={transicion}
      />
      <motion.path
        d={PIEZA_APRUEBA}
        fill={turquesa}
        initial={encajar ? { x: DX, y: DY, opacity: 0.6 } : false}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={transicion}
      />
    </svg>
  )
}
