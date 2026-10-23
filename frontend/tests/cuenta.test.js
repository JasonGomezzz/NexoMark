import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FOTO_MAX_BYTES,
  claveFoto,
  formatoPeso,
  iniciales,
  mensajeApi,
  validarFoto,
} from '../src/services/cuenta.js'

const archivo = (type, size) => ({ type, size, name: 'foto' })

test('validarFoto accepts JPG, PNG and WebP up to 2 MB, like Django', () => {
  assert.equal(validarFoto(archivo('image/jpeg', 300_000)), null)
  assert.equal(validarFoto(archivo('image/png', FOTO_MAX_BYTES)), null)
  assert.equal(validarFoto(archivo('image/webp', 10)), null)
  assert.match(validarFoto(archivo('image/png', FOTO_MAX_BYTES + 1)), /2 MB/)
  assert.match(validarFoto(archivo('image/gif', 1000)), /JPG, PNG o WebP/)
  assert.match(validarFoto(archivo('image/svg+xml', 1000)), /no SVG ni GIF/)
  assert.match(validarFoto(archivo('image/jpeg', 0)), /vacío/)
  assert.match(validarFoto(null), /Elige una foto/)
})

test('formatoPeso tells the size of the chosen photo', () => {
  assert.equal(formatoPeso(380 * 1024), '380 KB')
  assert.equal(formatoPeso(200), '1 KB')
  assert.equal(formatoPeso(1.5 * 1024 * 1024), '1.5 MB') // es-PE usa punto decimal
  assert.equal(formatoPeso(Number.NaN), '')
})

test('iniciales uses up to two words and never returns empty', () => {
  assert.equal(iniciales('Ana Torres Díaz'), 'AT')
  assert.equal(iniciales('  jason  '), 'J')
  assert.equal(iniciales(''), 'U')
  assert.equal(iniciales(undefined), 'U')
})

test('claveFoto changes with avatar_version and is null without a photo', () => {
  assert.equal(claveFoto({ id: 4, has_avatar: true, avatar_version: 1760000000 }), '4:1760000000')
  assert.notEqual(
    claveFoto({ id: 4, has_avatar: true, avatar_version: 1 }),
    claveFoto({ id: 4, has_avatar: true, avatar_version: 2 }),
  )
  assert.equal(claveFoto({ id: 4, has_avatar: false, avatar_version: null }), null)
  assert.equal(claveFoto(null), null)
})

test('mensajeApi prefers the field error, then the server message, then the default', () => {
  const campo = { response: { data: { message: 'Datos inválidos.', data: { avatar: ['La foto no debe superar 2 MB.'] } } } }
  assert.equal(mensajeApi(campo), 'La foto no debe superar 2 MB.')
  const anidado = { response: { data: { message: 'Revisa', data: { errors: { new_email: ['Correo inválido.'] } } } } }
  assert.equal(mensajeApi(anidado), 'Correo inválido.')
  const general = { response: { data: { message: 'La contraseña actual no es correcta.', data: {} } } }
  assert.equal(mensajeApi(general), 'La contraseña actual no es correcta.')
  assert.equal(mensajeApi({ response: { data: {} } }, 'Falló'), 'Falló')
  assert.match(mensajeApi(new Error('red')), /conectar con el servidor/)
})
