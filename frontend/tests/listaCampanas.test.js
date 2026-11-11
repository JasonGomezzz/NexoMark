import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { totalDeCampanas } from '../src/lib/listaCampanas.js'

test('mientras carga o si falla, el subtítulo no afirma cuántas campañas hay', () => {
  // El 0 inicial y el total que quedó de otro paso no son el total real.
  assert.equal(totalDeCampanas({ cargando: true, error: false, count: 0 }), null)
  assert.equal(totalDeCampanas({ cargando: true, error: false, count: 4 }), null)
  assert.equal(totalDeCampanas({ cargando: false, error: true, count: 0 }), null)
})

test('con la respuesta ya cargada, el subtítulo dice el total', () => {
  assert.equal(totalDeCampanas({ cargando: false, error: false, count: 0 }), 'Todavía no hay campañas.')
  assert.equal(totalDeCampanas({ cargando: false, error: false, count: 1 }), '1 campaña en total.')
  assert.equal(totalDeCampanas({ cargando: false, error: false, count: 12 }), '12 campañas en total.')
})

test('la lista de campañas usa ese subtítulo y muestra un esqueleto mientras carga', () => {
  const pagina = readFileSync(new URL('../src/pages/CampaignListPage.jsx', import.meta.url), 'utf8')
  assert.match(pagina, /totalDeCampanas\(\{ cargando, error, count \}\)/)
  assert.match(pagina, /total \?\? \(cargando && <span className="esqueleto/)
  assert.doesNotMatch(pagina, /count > 0 \?/)
})
