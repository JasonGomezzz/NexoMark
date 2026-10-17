import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buscarUrl,
  estadoVarianteX,
  longitudPonderada,
  puedePublicarX,
  textoConfirmacionCosto,
  validarTextoX,
} from '../src/services/xTexto.js'
import { etiquetaRed, mensajeMotivoRetornoX, puedeReintentar } from '../src/services/social.js'

// Los mismos casos que prueba el backend (services/x_texto.py): si divergen, falla uno de los dos lados.
const { casos } = JSON.parse(
  readFileSync(new URL('../../backend/apps/social/tests/casos_texto_x.json', import.meta.url), 'utf8'),
)
const textoDelCaso = (caso) => caso.texto ?? caso.repetir.repeat(caso.veces)

test('shared cases: weighted length, link detection and validity match the backend', () => {
  assert.ok(casos.length >= 30)
  for (const caso of casos) {
    const texto = textoDelCaso(caso)
    assert.equal(longitudPonderada(texto), caso.longitud, `longitud: ${caso.nombre}`)
    assert.equal(buscarUrl(texto), caso.url, `url: ${caso.nombre}`)
    assert.equal(validarTextoX(texto).valido, caso.valido, `valido: ${caso.nombre}`)
  }
})

test('validation messages match the server and explain the link cost', () => {
  assert.equal(validarTextoX('a'.repeat(281)).motivo, 'El texto para X tiene 281 de 280 caracteres ponderados.')
  assert.equal(validarTextoX('').motivo, 'El texto para X está vacío.')
  assert.match(validarTextoX('Compra en cafe.pe').motivo, /US\$0\.20/)
  assert.equal(validarTextoX('2x1 en capuchinos ☕').motivo, '')
})

test('variant states have Spanish labels and fall back to the raw value', () => {
  assert.equal(estadoVarianteX('pendiente_cliente').texto, 'Esperando al cliente')
  assert.equal(estadoVarianteX('aprobada').tono, 'ok')
  assert.equal(estadoVarianteX('rara').texto, 'rara')
})

test('publishing needs an approved variant, an account, the cost confirmation and budget left', () => {
  const config = { habilitado: true, costo_post_usd: '0.015', restantes: 3, maximo_mes: 20 }
  const aprobada = { estado: 'aprobada', vigente: true }
  assert.equal(puedePublicarX(aprobada, config, 7, true), true)
  assert.equal(puedePublicarX(aprobada, config, 7, false), false)
  assert.equal(puedePublicarX(aprobada, config, null, true), false)
  assert.equal(puedePublicarX({ estado: 'pendiente_cliente' }, config, 7, true), false)
  assert.equal(puedePublicarX({ ...aprobada, vigente: false }, config, 7, true), false)
  assert.equal(puedePublicarX(aprobada, { ...config, restantes: 0 }, 7, true), false)
  assert.equal(puedePublicarX(aprobada, { ...config, habilitado: false }, 7, true), false)
  assert.equal(
    textoConfirmacionCosto(config),
    'Confirmo publicar en X (costo aprox. US$0.015; quedan 3 de 20 este mes).',
  )
})

test('X publications never offer the Meta retry button and X has its own return messages', () => {
  assert.equal(etiquetaRed('x'), 'X')
  assert.equal(puedeReintentar({ red: 'x', estado: 'fallido', intentos: 1 }, 'aprobado'), false)
  assert.equal(puedeReintentar({ red: 'instagram', estado: 'fallido', intentos: 1 }, 'aprobado'), true)
  assert.match(mensajeMotivoRetornoX('cancelado'), /Cancelaste la conexión con X/)
  assert.equal(mensajeMotivoRetornoX('desactivado'), 'X está desactivado en este servidor.')
  assert.equal(mensajeMotivoRetornoX('raro'), 'No se pudo conectar la cuenta de X.')
})
