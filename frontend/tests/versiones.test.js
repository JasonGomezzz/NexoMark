import test from 'node:test'
import assert from 'node:assert/strict'
import { versionVigente } from '../src/lib/versiones.js'

const v = (id, version_number, texto_preview) => ({ id, version_number, texto_preview, tiene_imagen: false })

test('tras restaurar, la actual es la del copy vigente y no la última guardada', () => {
  // Restaurar la 1 guardó primero el copy de la 2 como versión 3.
  const versiones = [v(3, 3, 'copy de la dos'), v(2, 2, 'copy de la dos'), v(1, 1, 'copy de la uno')]
  assert.equal(versionVigente(versiones, 'copy de la uno').version_number, 1)
})

test('un copy editado a mano es la actual sin número de versión', () => {
  const actual = versionVigente([v(1, 1, 'original')], 'editado a mano')
  assert.equal(actual.version_number, null)
  assert.equal(actual.texto_preview, 'editado a mano')
  assert.equal(versionVigente([], 'algo'), null)
})

test('compara con la vista previa recortada a 200 caracteres', () => {
  const largo = 'a'.repeat(250)
  assert.equal(versionVigente([v(1, 1, `${'a'.repeat(200)}…`)], largo).version_number, 1)
})
