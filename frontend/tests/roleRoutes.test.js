import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const privateRoute = readFileSync(new URL('../src/components/PrivateRoute.jsx', import.meta.url), 'utf8')
const roleRoute = readFileSync(new URL('../src/components/RoleRoute.jsx', import.meta.url), 'utf8')

/** Devuelve el bloque <Route element={<RoleRoute roles={...} />}> que contiene la ruta, o null. */
function guardOf(path) {
  const index = app.indexOf(`path="${path}"`)
  assert.ok(index > 0, `falta la ruta ${path}`)
  const before = app.slice(0, index)
  const open = before.lastIndexOf('<RoleRoute roles=')
  const close = before.lastIndexOf('</Route>')
  if (open === -1 || close > open) return null
  return before.slice(open, before.indexOf('/>', open))
}

test('/stats, /dashboard, /settings y el retorno de Meta quedan abiertos a los tres roles', () => {
  for (const path of ['/stats', '/dashboard', '/settings', '/redes/meta-retorno', '/redes/tiktok-retorno']) {
    assert.equal(guardOf(path), null, path)
  }
})

test('cada ruta exclusiva tiene su rol', () => {
  assert.match(guardOf('/campaigns'), /STAFF/)
  assert.match(guardOf('/campaigns/:id'), /STAFF/)
  assert.match(guardOf('/credits'), /STAFF/)
  assert.match(guardOf('/campaigns/new'), /'marketero'/)
  assert.match(guardOf('/review/:id'), /'cliente'/)
  assert.match(guardOf('/client-campaigns'), /'cliente'/)
  assert.match(guardOf('/admin'), /'superadmin'/)
  assert.match(guardOf('/admin/analytics'), /'superadmin'/)
  assert.match(app, /const STAFF = \['marketero', 'superadmin'\]/)
})

test('el rol que decide las rutas viene de /api/auth/me/, no del navegador', () => {
  assert.match(privateRoute, /api\s*\.get\('\/api\/auth\/me\/'\)/)
  assert.match(privateRoute, /VerifiedUserContext\.Provider value=\{check\.user\}/)
  assert.match(roleRoute, /useVerifiedUser\(\)/)
  assert.doesNotMatch(roleRoute + app, /localStorage/)
})
