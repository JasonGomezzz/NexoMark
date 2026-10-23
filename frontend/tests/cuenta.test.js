import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FOTO_MAX_BYTES,
  claveFoto,
  formatoMinutos,
  formatoPeso,
  iniciales,
  mensajeApi,
  pasosCambioCorreo,
  segundosHasta,
  validarCambioCorreo,
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

test('the email change countdown reads the server expiry and stops at zero', () => {
  const ahora = Date.parse('2026-10-22T15:00:00Z')
  assert.equal(segundosHasta('2026-10-22T15:30:00Z', ahora), 1800)
  assert.equal(segundosHasta('2026-10-22T14:59:00Z', ahora), 0)
  assert.equal(segundosHasta(null, ahora), 0)
  assert.equal(formatoMinutos(1800), '30:00')
  assert.equal(formatoMinutos(65), '1:05')
  assert.equal(formatoMinutos(-3), '0:00')
})

test('pasosCambioCorreo lists the current and the new address with their confirmation', () => {
  const pasos = pasosCambioCorreo(
    { new_email: 'nuevo@agencia.pe', old_confirmed: true, new_confirmed: false, expires_at: '2026-10-22T15:30:00Z' },
    'ana@agencia.pe',
  )
  assert.deepEqual(
    pasos.map((p) => [p.lado, p.correo, p.confirmado]),
    [
      ['old', 'ana@agencia.pe', true],
      ['new', 'nuevo@agencia.pe', false],
    ],
  )
  assert.deepEqual(pasosCambioCorreo(null, 'ana@agencia.pe'), [])
})

test('validarCambioCorreo checks the new address and the password before calling Django', () => {
  assert.equal(validarCambioCorreo({ nuevo: ' Nuevo@Agencia.pe ', password: 'x' }, 'ana@agencia.pe'), null)
  assert.match(validarCambioCorreo({ nuevo: '', password: 'x' }, 'ana@agencia.pe'), /correo nuevo/)
  assert.match(validarCambioCorreo({ nuevo: 'sin-arroba', password: 'x' }, 'ana@agencia.pe'), /no parece válido/)
  assert.match(validarCambioCorreo({ nuevo: 'ANA@agencia.pe', password: 'x' }, 'ana@agencia.pe'), /ya es tu correo/)
  assert.match(validarCambioCorreo({ nuevo: 'otro@agencia.pe', password: '' }, 'ana@agencia.pe'), /contraseña actual/)
})
