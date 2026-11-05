import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import {
  refreshAccessToken, clearSession, attachSessionInterceptors, startSession, getAuthItem, setAuthItem,
  logoutOnServer, destinoTrasLogin,
} from '../src/services/session.js'

function memoryStorage(entries = []) {
  const values = new Map(entries)
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage([['access_token', 'old-access'], ['refresh_token', 'old-refresh']])
  globalThis.sessionStorage = memoryStorage()
  globalThis.window = { dispatchEvent() {}, location: { href: '' } }
})

test('socket and both APIs share one refresh; a stale 401 reuses its rotated token', async () => {
  let calls = 0
  let complete
  axios.post = () => { calls++; return new Promise((resolve) => { complete = resolve }) }
  const first = refreshAccessToken('old-access')
  const second = refreshAccessToken('old-access')
  assert.equal(first, second)
  complete({ data: { access: 'new-access', refresh: 'new-refresh' } })
  assert.equal(await first, 'new-access')
  assert.equal(await refreshAccessToken('old-access'), 'new-access')
  assert.equal(calls, 1)
  assert.equal(localStorage.getItem('refresh_token'), 'new-refresh')
})

test('transport or 5xx failure preserves tokens; invalid refresh clears them', async () => {
  axios.post = async () => { throw { response: { status: 503 } } }
  await assert.rejects(refreshAccessToken('old-access'))
  assert.equal(localStorage.getItem('access_token'), 'old-access')
  axios.post = async () => { throw { response: { status: 401 } } }
  await assert.rejects(refreshAccessToken('old-access'))
  assert.equal(localStorage.getItem('access_token'), null)
  assert.equal(window.location.href, '/login')
})

test('refresh completing after logout never restores the session', async () => {
  let complete
  axios.post = () => new Promise((resolve) => { complete = resolve })
  const pending = refreshAccessToken('old-access')
  clearSession({ redirect: false })
  complete({ data: { access: 'late-access', refresh: 'late-refresh' } })
  await assert.rejects(pending)
  assert.equal(localStorage.getItem('access_token'), null)
})

test('Django and Spring interceptors retry simultaneous 401s with one rotation', async () => {
  let refreshes = 0
  axios.post = async () => { refreshes++; return { data: { access: 'new-access', refresh: 'new-refresh' } } }
  const client = () => {
    const api = axios.create({ adapter: async (config) => {
      if (config.headers.Authorization === 'Bearer old-access') {
        throw { config, response: { status: 401 } }
      }
      return { config, status: 200, data: 'authorized' }
    } })
    attachSessionInterceptors(api)
    return api
  }
  const responses = await Promise.all([client().get('/api/campaigns/'), client().get('/api/v1/campaigns/mine')])
  assert.deepEqual(responses.map((response) => response.data), ['authorized', 'authorized'])
  assert.equal(refreshes, 1)
})

const credentials = { access: 'access', refresh: 'refresh', role: 'marketero', nombre: 'Prueba' }

test('sin "recordarme" la sesión y su renovación quedan solo en esta pestaña', async () => {
  startSession(credentials)
  assert.equal(sessionStorage.getItem('access_token'), 'access')
  assert.equal(localStorage.getItem('access_token'), null)
  axios.post = async () => ({ data: { access: 'renewed', refresh: 'renewed-refresh' } })
  assert.equal(await refreshAccessToken('access'), 'renewed')
  assert.equal(sessionStorage.getItem('refresh_token'), 'renewed-refresh')
  assert.equal(localStorage.getItem('refresh_token'), null)
  assert.equal(getAuthItem('user_role'), 'marketero')
})

test('con "recordarme" la sesión persiste en localStorage', () => {
  startSession(credentials, { remember: true })
  setAuthItem('user_email', 'marketero@test.com')
  assert.equal(localStorage.getItem('user_email'), 'marketero@test.com')
  assert.equal(sessionStorage.getItem('access_token'), null)
})

test('cambiar de modo o cerrar sesión borra credenciales viejas y conserva preferencias', () => {
  localStorage.setItem('marketmind_theme', 'dark')
  startSession(credentials, { remember: true })
  startSession({ ...credentials, role: 'cliente' })
  assert.equal(localStorage.getItem('user_role'), null)
  assert.equal(getAuthItem('user_role'), 'cliente')
  clearSession({ redirect: false })
  assert.equal(getAuthItem('access_token'), null)
  assert.equal(sessionStorage.getItem('user_role'), null)
  assert.equal(localStorage.getItem('marketmind_theme'), 'dark')
})

test('cerrar sesión con el access vencido invalida también el refresh rotado', async () => {
  const enviados = []
  const client = {
    post: async (url, body) => {
      enviados.push(body.refresh)
      if (body.refresh === 'old-refresh') {
        // El interceptor renovó a mitad del logout y reenvió el refresh viejo.
        setAuthItem('refresh_token', 'new-refresh')
        throw Object.assign(new Error('token en lista negra'), { response: { status: 400 } })
      }
    },
  }
  await logoutOnServer(client)
  assert.deepEqual(enviados, ['old-refresh', 'new-refresh'])
})

test('tras entrar vuelve a la página pedida, solo si es interna', () => {
  assert.equal(destinoTrasLogin('/review/12'), '/review/12')
  assert.equal(destinoTrasLogin('/campaigns?etapa=aprobar'), '/campaigns?etapa=aprobar')
  assert.equal(destinoTrasLogin(undefined), '/dashboard')
  assert.equal(destinoTrasLogin('//evil.example/x'), '/dashboard')
  assert.equal(destinoTrasLogin('https://evil.example'), '/dashboard')
  assert.equal(destinoTrasLogin('/login'), '/dashboard')
})
