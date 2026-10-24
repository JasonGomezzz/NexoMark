import assert from 'node:assert/strict'
import { test } from 'node:test'

// Solo las funciones de formato: sin dato nunca es 0.
const { formatoSegundos, formatoTasa, formatoNumero } = await import('../src/components/analytics/medicionFormato.js')

test('lo que no se midió es "sin dato"', () => {
  assert.equal(formatoSegundos(null), 'sin dato')
  assert.equal(formatoTasa(undefined), 'sin dato')
  assert.equal(formatoNumero(null), 'sin dato')
})

test('formatea segundos, minutos, tasas y decimales', () => {
  assert.equal(formatoSegundos(12.5), '12,5 s')
  assert.equal(formatoSegundos(15), '15 s')
  assert.equal(formatoSegundos(95), '1 min 35 s')
  assert.equal(formatoTasa(0.667), '67 %')
  assert.equal(formatoNumero(0.5), '0,5')
  assert.equal(formatoNumero(0), '0')
})
