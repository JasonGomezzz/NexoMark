import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('email confirmation is public, explicit and does not submit on mount', () => {
  const page = source('../src/pages/EmailChangeConfirmPage.jsx')
  assert.match(page, /axios.create/)
  assert.match(page, /window.history.replaceState/)
  assert.match(page, /onClick=\{confirm\}/)
  assert.match(page, /if \(!valid \|\| locked.current \|\| done \|\| remaining > 0\) return/)
  assert.doesNotMatch(page, /useEffect\(\(\) => \{[^]*?publicApi.post[^]*?\}, \[\]\)/)
  assert.match(source('../src/App.jsx'), /path="\/confirm-email-change" element=\{<EmailChangeConfirmPage \/>\}/)
})

test('email editing is separate, password-protected and supports pending cancellation', () => {
  const component = source('../src/components/EmailChangeSettings.jsx')
  assert.match(component, /\[editing, setEditing\] = useState\(false\)/)
  assert.match(component, /current_password: password/)
  assert.match(component, /api.delete\('\/api\/auth\/me\/change-email\/'\)/)
  assert.match(component, /setPassword\(''\)/)
  assert.match(component, /if \(locked.current\) return/)
  assert.doesNotMatch(component, /onBlur=|localStorage|sessionStorage/)
})
