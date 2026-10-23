/**
 * Acceso con Google (rutas públicas de Django). Va sin el JWT de la sesión: un
 * token local vencido no debe interferir con entrar por Google.
 */
import axios from 'axios'

const publico = axios.create({ baseURL: import.meta.env.VITE_API_URL })

let sdk = null

export const googleApi = {
  /** {configured, client_id}. Sin client ID en el servidor, el botón no se muestra. */
  config: () => publico.get('/api/auth/google/config/').then((r) => r.data.data),
  /** {ticket, proof, nonce, client_id}. En registro el rol se fija antes de abrir Google. */
  desafio: (proposito, rol) =>
    publico
      .post('/api/auth/google/challenge/', proposito === 'register' ? { purpose: proposito, role: rol } : { purpose: proposito })
      .then((r) => r.data.data),
  /** Responde como /api/auth/token/: {access, refresh, role, nombre, email}. */
  completar: ({ ticket, proof, credential }, password) =>
    publico
      .post('/api/auth/google/complete/', { ticket, proof, credential, ...(password ? { current_password: password } : {}) })
      .then((r) => r.data),
}

/** Carga una sola vez Google Identity Services (el botón oficial). */
export function cargarGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (sdk) return sdk
  sdk = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const espera = window.setTimeout(() => {
      script.remove()
      reject(new Error('Google tardó demasiado en responder.'))
    }, 15000)
    script.onload = () => {
      window.clearTimeout(espera)
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('No se pudo cargar el acceso con Google.'))
    }
    script.onerror = () => {
      window.clearTimeout(espera)
      script.remove()
      reject(new Error('No se pudo cargar Google. Revisa tu conexión o el bloqueador de anuncios.'))
    }
    document.head.appendChild(script)
  }).catch((error) => {
    sdk = null
    throw error
  })
  return sdk
}
