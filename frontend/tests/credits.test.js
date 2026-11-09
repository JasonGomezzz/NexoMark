import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GENERATION_CREDIT_COST,
  PLANS,
  alcanzaParaGenerar,
  avisoConsumo,
  costoGeneracion,
  creditosConGeneraciones,
  generaciones,
} from '../src/lib/credits.js'

test('planes de lanzamiento: precios, créditos y disponibilidad', () => {
  assert.equal(GENERATION_CREDIT_COST, 4)
  assert.deepEqual(
    PLANS.map((p) => [p.key, p.precio, p.creditos, p.disponible]),
    [
      ['freelance', 59, 100, true],
      ['agencia', 149, 400, true],
      ['agencia_plus', 299, 1000, false],
    ],
  )
  assert.deepEqual(PLANS.map((p) => generaciones(p.creditos)), [25, 100, 250])
})

test('siempre muestra créditos junto a generaciones', () => {
  assert.equal(creditosConGeneraciones(100), '100 créditos · hasta 25 generaciones')
  assert.equal(creditosConGeneraciones(5), '5 créditos · hasta 1 generación')
  assert.equal(creditosConGeneraciones(null), 'sin dato')
})

test('avisa el consumo antes de generar y respeta el costo del backend', () => {
  assert.equal(avisoConsumo(100), 'Esta generación usará 4 créditos. Te quedan 100.')
  assert.equal(avisoConsumo(null), 'Esta generación usará 4 créditos.')
  assert.equal(costoGeneracion({ costo_generacion: 6 }), 6)
  assert.equal(costoGeneracion({}), 4)
  assert.equal(alcanzaParaGenerar(3), false)
  assert.equal(alcanzaParaGenerar(4), true)
})
