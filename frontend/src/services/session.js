import axios from 'axios'

export const SESSION_CHANGED = 'marketmind:session-changed'
const AUTH_KEYS = ['access_token', 'refresh_token', 'user_role', 'user_nombre', 'user_email']
let pendingRefresh = null

// ---------------------------------------------------------------------------
// Almacenamiento de la sesión ("recordarme").
// Con "Mantener sesión iniciada" la sesión vive en localStorage (sobrevive al
// cierre del navegador y se comparte entre pestañas); sin marcarlo vive en
// sessionStorage (se borra al cerrar la pestaña). La sesión activa es la de
// sessionStorage si existe; si no, la de localStorage. Las preferencias que no
// son de sesión (por ejemplo el tema) nunca se tocan.
// ---------------------------------------------------------------------------

function activeStore() {
  const tabStore = globalThis.sessionStorage
  if (tabStore?.getItem('access_token') || tabStore?.getItem('refresh_token')) return tabStore
  return globalThis.localStorage
}

function notify() {
  globalThis.window?.dispatchEvent(new Event(SESSION_CHANGED))
}

export function getAuthItem(key) {
  return activeStore()?.getItem(key) ?? null
}

export function setAuthItem(key, value) {
  const store = activeStore()
  if (value === undefined || value === null || value === '') store.removeItem(key)
  else store.setItem(key, String(value))
}

function clearAuthStorage() {
  for (const store of [globalThis.sessionStorage, globalThis.localStorage]) {
    if (!store) continue
    for (const key of AUTH_KEYS) store.removeItem(key)
  }
}

/** Inicia sesión desde cero en el almacenamiento elegido (borra restos de la otra). */
export function startSession({ access, refresh, role, nombre }, { remember = false } = {}) {
  clearAuthStorage()
  const target = remember ? globalThis.localStorage : globalThis.sessionStorage
  target.setItem('access_token', access)
  if (refresh) target.setItem('refresh_token', refresh)
  if (role) target.setItem('user_role', role)
  if (nombre) target.setItem('user_nombre', nombre)
  notify()
}

/** Guarda tokens renovados en el mismo almacenamiento donde vive la sesión. */
export function storeTokens({ access, refresh }) {
  setAuthItem('access_token', access)
  if (refresh) setAuthItem('refresh_token', refresh)
  notify()
}

export function clearSession({ redirect = true } = {}) {
  clearAuthStorage()
  notify()
  if (redirect) globalThis.window.location.href = '/login'
}

/**
 * Invalida en Django el refresh de esta sesión. Si el access ya venció, el interceptor
 * renueva y reintenta con el cuerpo original, que lleva el refresh ya rotado (400): en
 * ese caso se repite con el refresh nuevo para que no quede válido 7 días.
 */
export async function logoutOnServer(client) {
  const refresh = getAuthItem('refresh_token')
  if (!refresh) return
  try {
    await client.post('/api/auth/logout/', { refresh })
  } catch {
    const rotado = getAuthItem('refresh_token')
    if (rotado && rotado !== refresh) await client.post('/api/auth/logout/', { refresh: rotado })
  }
}

/**
 * Página a la que volver después de iniciar sesión (la que se pidió sin sesión).
 * Solo rutas internas: nada de `//otro-sitio`, URLs absolutas ni volver al login.
 */
export function destinoTrasLogin(desde) {
  if (typeof desde !== 'string' || !desde.startsWith('/') || desde.startsWith('//')) return '/dashboard'
  if (/^\/(login|register)\b/.test(desde)) return '/dashboard'
  return desde
}

// One rotation for Django, Spring and WebSocket in this tab. A late 401 that used
// an old token reuses the newer access token instead of rotating refresh again.
export function refreshAccessToken(rejectedToken) {
  const current = getAuthItem('access_token')
  if (rejectedToken && current && rejectedToken !== current) return Promise.resolve(current)
  if (pendingRefresh) return pendingRefresh
  const refresh = getAuthItem('refresh_token')
  if (!refresh) {
    clearSession()
    return Promise.reject(new Error('Sesión expirada.'))
  }
  pendingRefresh = axios.post(`${import.meta.env?.VITE_API_URL || ''}/api/auth/token/refresh/`, { refresh })
    .then(({ data }) => {
      // A response belonging to a logged-out or replaced session cannot resurrect it.
      if (getAuthItem('refresh_token') !== refresh) throw new Error('La sesión cambió.')
      if (!data.access) throw new Error('Respuesta de renovación inválida.')
      storeTokens(data)
      return data.access
    })
    .catch((error) => {
      if ([401, 403].includes(error.response?.status)
          && getAuthItem('refresh_token') === refresh) clearSession()
      // Network and server failures are retryable; preserve the signed-in session.
      throw error
    })
    .finally(() => { pendingRefresh = null })
  return pendingRefresh
}

export function attachSessionInterceptors(client) {
  client.interceptors.request.use((config) => {
    const token = getAuthItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  client.interceptors.response.use((response) => response, async (error) => {
    const original = error.config
    const authEntry = /\/api\/auth\/(token|register)\//.test(original?.url || '')
    if (error.response?.status !== 401 || !original || original._retry || authEntry) throw error
    original._retry = true
    const rejectedToken = original.headers?.Authorization?.replace(/^Bearer /, '')
    const token = await refreshAccessToken(rejectedToken)
    original.headers.Authorization = `Bearer ${token}`
    return client(original)
  })
}
