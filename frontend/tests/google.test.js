import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  RENOVAR_DESAFIO_MS,
  anchoBotonGoogle,
  necesitaNuevoDesafio,
  resultadoGoogle,
  textoBotonGoogle,
} from '../src/services/google.js'

const error = (status, data, message) => ({ response: { status, data: { success: false, message, data } } })

test('link_required asks for the NexoMark password; a 400 means it was wrong', () => {
  const primera = resultadoGoogle(error(409, { link_required: true }, 'Ya existe una cuenta con ese correo.'))
  assert.equal(primera.tipo, 'vincular')
  assert.equal(primera.contrasenaIncorrecta, false)
  assert.equal(primera.mensaje, 'Ya existe una cuenta con ese correo.')
  const mala = resultadoGoogle(error(400, { link_required: true }, 'La contraseña de NexoMark no es correcta.'))
  assert.equal(mala.tipo, 'vincular')
  assert.equal(mala.contrasenaIncorrecta, true)
  assert.equal(necesitaNuevoDesafio('vincular'), false)
})

test('registration, suspension, expiry and throttling keep the server message', () => {
  const registro = resultadoGoogle(error(409, { registration_required: true }, 'Aún no tienes cuenta.'))
  assert.deepEqual([registro.tipo, registro.mensaje], ['registro', 'Aún no tienes cuenta.'])
  const suspendida = resultadoGoogle(error(403, { suspended: true }, 'Tu cuenta está suspendida.'))
  assert.equal(suspendida.tipo, 'suspendida')
  const vencido = resultadoGoogle(error(400, { expired: true }, 'El intento venció o ya se usó.'))
  assert.equal(vencido.tipo, 'vencido')
  assert.equal(necesitaNuevoDesafio('vencido'), true)
  assert.equal(resultadoGoogle(error(429, {}, undefined)).tipo, 'espera')
  assert.match(resultadoGoogle(error(400, {}, undefined)).mensaje, /No se pudo entrar con Google/)
  assert.match(resultadoGoogle(new Error('sin red')).mensaje, /conectar con el servidor/)
})

test('the official button fits the form (200–400 px) and names the action', () => {
  assert.equal(anchoBotonGoogle(343.7), 343)
  assert.equal(anchoBotonGoogle(416), 400)
  assert.equal(anchoBotonGoogle(120), 200)
  assert.equal(anchoBotonGoogle(undefined), 200)
  assert.equal(textoBotonGoogle('register'), 'signup_with')
  assert.equal(textoBotonGoogle('login'), 'continue_with')
})

test('the challenge is renewed before the 10-minute ticket expires', () => {
  assert.ok(RENOVAR_DESAFIO_MS < 10 * 60 * 1000)
  assert.ok(RENOVAR_DESAFIO_MS >= 5 * 60 * 1000)
})

test('Google access never stores the ID token and hides itself without a client ID', () => {
  const componente = readFileSync(new URL('../src/components/auth/GoogleAccess.jsx', import.meta.url), 'utf8')
  const servicio = readFileSync(new URL('../src/services/googleApi.js', import.meta.url), 'utf8')
  assert.doesNotMatch(componente + servicio, /localStorage|sessionStorage/)
  assert.match(componente, /if \(!configurado\) return null/)
  assert.match(componente, /renderButton\(/)
  assert.doesNotMatch(componente, /\.prompt\(/)
  // Las rutas públicas de Google van sin el JWT de la sesión.
  assert.doesNotMatch(servicio, /from '\.\/api'/)
})
