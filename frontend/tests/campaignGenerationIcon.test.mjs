import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('campaign generation uses the robot icon without changing the submit action', () => {
  const source = readFileSync(new URL('../src/pages/NewCampaignPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /<Button type="submit" size="lg" disabled=\{submitting\} className="w-full">\s*<Bot aria-hidden="true" className="h-5 w-5" \/>/)
  assert.match(source, /<Bot aria-hidden="true" className="h-7 w-7" \/>/)
  assert.match(source, /\{submitting \? 'Generando con IA…' : 'Generar campaña con IA'\}/)
  assert.match(source, /bg-primary\/10 text-primary/)
})
