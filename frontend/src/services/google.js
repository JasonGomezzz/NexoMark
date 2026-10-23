/**
 * Entrar o registrarse con Google: lógica pura (sin React ni axios), probada en
 * tests/google.test.js. El flujo es challenge → nonce en el botón oficial de
 * Google → complete; Django verifica el ID token y entrega sus propios JWT.
 */

/** Texto del botón oficial de Google Identity Services según la pantalla. */
export function textoBotonGoogle(proposito) {
  return proposito === 'register' ? 'signup_with' : 'continue_with'
}

/** Google acepta un ancho de 200 a 400 px: se ajusta al del formulario. */
export function anchoBotonGoogle(anchoContenedor) {
  const ancho = Math.floor(Number(anchoContenedor) || 0)
  return Math.min(400, Math.max(200, ancho))
}

/** El ticket del servidor vale 10 minutos; se renueva antes para que el botón no quede vencido. */
export const RENOVAR_DESAFIO_MS = 9 * 60 * 1000

/**
 * Qué hacer con la respuesta de error de `google/complete/`. Los mensajes son
 * los del servidor; solo se agregan textos cuando no llega ninguno.
 * @returns {{ tipo: 'vincular' | 'registro' | 'suspendida' | 'vencido' | 'espera' | 'error', mensaje: string, contrasenaIncorrecta?: boolean }}
 */
export function resultadoGoogle(error) {
  const respuesta = error?.response
  if (!respuesta) {
    return { tipo: 'error', mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.' }
  }
  const datos = respuesta.data?.data ?? {}
  const mensaje = respuesta.data?.message
  if (datos.link_required) {
    return {
      tipo: 'vincular',
      // 409: primera vez (pide la contraseña); 400: la contraseña escrita no es la de NexoMark.
      contrasenaIncorrecta: respuesta.status === 400,
      mensaje: mensaje || 'Ya existe una cuenta con ese correo. Confirma tu contraseña de NexoMark para vincular Google.',
    }
  }
  if (datos.registration_required) {
    return { tipo: 'registro', mensaje: mensaje || 'Aún no tienes cuenta. Regístrate con Google y elige cómo usarás NexoMark.' }
  }
  if (datos.suspended) {
    return { tipo: 'suspendida', mensaje: mensaje || 'Tu cuenta está suspendida. Contacta al administrador.' }
  }
  if (datos.expired) {
    return { tipo: 'vencido', mensaje: mensaje || 'El intento venció. Vuelve a tocar el botón de Google.' }
  }
  if (respuesta.status === 429) {
    return { tipo: 'espera', mensaje: mensaje || 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' }
  }
  return { tipo: 'error', mensaje: mensaje || 'No se pudo entrar con Google. Vuelve a intentarlo.' }
}

/** Tras estos resultados el mismo intento ya no sirve: se pide otro desafío (nonce nuevo). */
export function necesitaNuevoDesafio(tipo) {
  return tipo !== 'vincular'
}
