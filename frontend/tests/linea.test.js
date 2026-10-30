import test from 'node:test'
import assert from 'node:assert/strict'
import {
  conteosDeLinea,
  estacionDeRuta,
  estacionesDeRol,
  etapaDeEstado,
} from '../src/components/linea/estaciones.js'

test('cada rol recorre su tramo de la línea', () => {
  assert.deepEqual(estacionesDeRol('marketero').map((e) => e.id), ['dictar', 'generar', 'aprobar', 'publicar', 'medir'])
  assert.deepEqual(estacionesDeRol('superadmin').map((e) => e.id), ['generar', 'aprobar', 'publicar', 'medir'])
  assert.deepEqual(estacionesDeRol('cliente').map((e) => e.id), ['aprobar', 'publicar', 'medir'])
  // Un rol desconocido nunca ve estaciones de personal.
  assert.deepEqual(estacionesDeRol('otro').map((e) => e.id), ['aprobar', 'publicar', 'medir'])
})

test('las estaciones llevan a rutas que el rol puede abrir', () => {
  const rutas = Object.fromEntries(estacionesDeRol('marketero').map((e) => [e.id, e.to]))
  assert.equal(rutas.dictar, '/campaigns/new')
  assert.equal(rutas.aprobar, '/campaigns?etapa=aprobar')
  assert.equal(rutas.medir, '/stats')
  const cliente = Object.fromEntries(estacionesDeRol('cliente').map((e) => [e.id, e.to]))
  assert.equal(cliente.aprobar, '/client-campaigns')
  assert.equal(cliente.publicar, '/client-campaigns?etapa=publicar')
})

test('cada estado de campaña cae en una etapa', () => {
  assert.equal(etapaDeEstado('borrador'), 'generar')
  assert.equal(etapaDeEstado('generado'), 'generar')
  assert.equal(etapaDeEstado('rechazado'), 'generar')
  assert.equal(etapaDeEstado('pendiente_aprobacion'), 'aprobar')
  assert.equal(etapaDeEstado('aprobado'), 'publicar')
  assert.equal(etapaDeEstado('fracaso'), null)
})

test('la estación actual sale de la ruta', () => {
  assert.equal(estacionDeRuta('/campaigns/new'), 'dictar')
  assert.equal(estacionDeRuta('/campaigns', '?etapa=publicar'), 'publicar')
  assert.equal(estacionDeRuta('/campaigns', ''), null)
  assert.equal(estacionDeRuta('/campaigns', '?etapa=inventada'), null)
  assert.equal(estacionDeRuta('/client-campaigns', ''), 'aprobar')
  assert.equal(estacionDeRuta('/review/12'), 'aprobar')
  assert.equal(estacionDeRuta('/stats'), 'medir')
  assert.equal(estacionDeRuta('/dashboard'), null)
})

test('los conteos suman por etapa y no inventan ceros', () => {
  const stats = { borrador: 1, pendiente_ia: 0, generado: 9, rechazado: 2, pendiente_aprobacion: 0, aprobado: 7, fracaso: 1 }
  assert.deepEqual(conteosDeLinea('marketero', stats), { generar: 12, aprobar: 0, publicar: 7 })
  assert.deepEqual(conteosDeLinea('cliente', { pendientes: 2 }), { aprobar: 2, publicar: null })
  assert.deepEqual(conteosDeLinea('marketero', null), {})
})
