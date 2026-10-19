import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadGoogleIdentity } from '../src/lib/googleIdentity.js'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('Google sign in uses official rendered button, nonce and no automatic One Tap', () => {
  const component = source('../src/components/auth/GoogleSignIn.jsx')
  assert.match(component, /sdk.renderButton/)
  assert.match(component, /nonce: data.data.nonce, auto_select: false/)
  assert.match(component, /credential: response.credential/)
  assert.match(component, /link_required/)
  assert.match(component, /No introduzcas la contraseña de Google/)
  assert.doesNotMatch(component, /localStorage|sessionStorage|\.prompt\(/)
  assert.match(component, /Google está pendiente de configuración/)
})

test('login honors persistence and registration binds the explicitly selected role', () => {
  assert.match(source('../src/pages/LoginPage.jsx'), /startAuthSession\(data, Boolean\(getValues\('remember'\)\)\)/)
  assert.match(source('../src/pages/RegisterPage.jsx'), /<GoogleSignIn key=\{rolSel\} purpose="register" role=\{rolSel\}/)
  assert.match(source('../src/components/GoogleAccountSettings.jsx'), /current_password: password/)
  assert.match(source('../src/components/GoogleAccountSettings.jsx'), /clearAuthSession\(\)/)
  const icon = source('../src/components/auth/GoogleIcon.jsx')
  for (const color of ['#4285F4', '#34A853', '#FBBC05', '#EA4335']) assert.ok(icon.includes(color))
})

test('already loaded Google library is reused without another script', async () => {
  const previous = globalThis.window
  const sdk = { marker: 'existing-sdk' }
  globalThis.window = { google: { accounts: { id: sdk } } }
  try { assert.equal(await loadGoogleIdentity(), sdk) }
  finally { globalThis.window = previous }
})
