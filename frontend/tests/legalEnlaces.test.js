import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DOCUMENTOS_LEGALES } from '../src/lib/legal.js'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

test('login, registro, planes y pie de la landing enlazan los documentos que les corresponden', () => {
  const claves = new Set(DOCUMENTOS_LEGALES.map((d) => d.clave))
  const usos = {
    '../src/pages/LoginPage.jsx': ['terminos', 'privacidad', 'reclamos'],
    '../src/pages/RegisterPage.jsx': ['terminos', 'privacidad', 'cookies'],
    '../src/components/campaign/PlanesModal.jsx': ['compras', 'arrepentimiento', 'reclamos'],
    '../src/components/landing/PricingSection.jsx': ['compras'],
  }
  for (const [ruta, esperadas] of Object.entries(usos)) {
    const codigo = leer(ruta)
    const usadas = [...codigo.matchAll(/<EnlaceLegal clave="([a-z]+)"/g)].map((m) => m[1])
    for (const clave of usadas) assert.ok(claves.has(clave), `${ruta} usa la clave desconocida ${clave}`)
    for (const clave of esperadas) assert.ok(usadas.includes(clave), `${ruta} debe enlazar ${clave}`)
  }
  assert.match(leer('../src/components/landing/LandingFooter.jsx'), /DOCUMENTOS_LEGALES\.map/)
})

test('la compra simulada se anuncia donde se paga y el formulario avisa de no usar la tarjeta real', () => {
  const modal = leer('../src/components/campaign/PlanesModal.jsx')
  assert.match(modal, /Pasarela de pago simulada/)
  assert.match(modal, /No escribas tu tarjeta real/)
})
