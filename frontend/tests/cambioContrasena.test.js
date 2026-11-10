import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

test('al cambiar la contraseña la web cierra la sesión local y vuelve al login', () => {
  const pagina = leer('../src/pages/AccountSettingsPage.jsx')
  const cambio = pagina.slice(pagina.indexOf('async function handleChangePassword'))
  const post = cambio.indexOf("api.post('/api/auth/me/change-password/'")
  const limpiar = cambio.indexOf('clearSession({ redirect: false })')
  const irAlLogin = cambio.indexOf("navigate('/login', { replace: true })")
  // El servidor sube token_version: la sesión local ya no sirve y no se deja viva.
  assert.ok(post >= 0 && limpiar > post && irAlLogin > limpiar, 'orden: pedir cambio, limpiar sesión, ir al login')
  // El mensaje del servidor (incluye «Demasiados intentos…» si hay límite) llega al usuario.
  assert.match(cambio, /err\.response\?\.data\?\.message/)
})
