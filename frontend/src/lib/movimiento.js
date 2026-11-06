/**
 * Movimiento de los cajones laterales (menú, historial de versiones, detalle de una
 * publicación). Entran deslizándose desde su borde con la curva de cajón de iOS.
 *
 * Con "reducir movimiento" no se deslizan: aparecen con un fundido corto, así se sigue
 * viendo que algo se abrió o se cerró, pero sin desplazamiento. Se decide aquí y no con
 * MotionConfig, porque MotionConfig no frena la clave `transform` escrita como texto.
 *
 * @param {'izquierda'|'derecha'} lado borde por el que entra
 * @param {boolean} reducir resultado de useReducedMotion()
 */
export function cajon(lado, reducir) {
  if (reducir) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
    }
  }
  const fuera = lado === 'izquierda' ? 'translateX(-100%)' : 'translateX(100%)'
  return {
    initial: { transform: fuera },
    animate: { transform: 'translateX(0%)' },
    exit: { transform: fuera },
    transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
  }
}
