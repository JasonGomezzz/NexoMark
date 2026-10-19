import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('password settings prevent duplicate submits, require matching confirmation and reauthenticate', () => {
  const source = readFileSync(new URL('../src/pages/AccountSettingsPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /if \(passwordRequest.current \|\| savingPassword \|\| Date.now\(\) < passwordRetryUntil\) return/)
  assert.match(source, /newPassword === confirmPassword && newPassword !== currentPassword/)
  assert.match(source, /clearAuthSession\(\)\s+navigate\('\/login', \{ replace: true, state: \{ securityNotice: data.message \} \}\)/)
  assert.match(source, /err.response\?\.status === 429/)
  assert.match(source, /setPasswordRetryUntil/)
})

test('login shows the password-change outcome without persisting credentials', () => {
  const source = readFileSync(new URL('../src/pages/LoginPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /typeof location.state\?\.securityNotice === 'string'/)
  assert.match(source, /role="status"[^]*?\{location.state.securityNotice\}/)
})
