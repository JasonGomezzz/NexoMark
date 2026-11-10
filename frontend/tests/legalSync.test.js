import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { ROOT_FILES } from '../../scripts/prepare-legal-site.mjs'
import { DOCUMENTOS_LEGALES, urlLegal, documentoLegal } from '../src/lib/legal.js'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')
const HISTORIAL = /^(privacidad|terminos)-v\d+\.\d+-\d{4}-\d{2}-\d{2}\.html$/

test('cada documento legal que enlaza la web existe en legal-site y en la copia que sirve la web', () => {
  assert.ok(DOCUMENTOS_LEGALES.length >= 8)
  for (const { archivo } of DOCUMENTOS_LEGALES) {
    assert.ok(ROOT_FILES.includes(archivo), `${archivo} no está en la lista de archivos públicos`)
    assert.ok(existsSync(new URL(`../../legal-site/${archivo}`, import.meta.url)), `${archivo} falta en legal-site/`)
    assert.ok(existsSync(new URL(`../public/legal/${archivo}`, import.meta.url)), `${archivo} falta en public/legal/ (npm run legal:sync)`)
  }
})

test('public/legal es una copia exacta de legal-site: si falla, ejecutar npm run legal:sync', () => {
  for (const archivo of ROOT_FILES) {
    assert.equal(leer(`../public/legal/${archivo}`), leer(`../../legal-site/${archivo}`), `${archivo} está desfasado`)
  }
  const historial = readdirSync(new URL('../../legal-site/historial/', import.meta.url)).filter((n) => HISTORIAL.test(n))
  const copiados = readdirSync(new URL('../public/legal/historial/', import.meta.url)).sort()
  assert.deepEqual(copiados, historial.sort(), 'el historial copiado no coincide')
  for (const nombre of historial) {
    assert.equal(leer(`../public/legal/historial/${nombre}`), leer(`../../legal-site/historial/${nombre}`), `historial/${nombre} está desfasado`)
  }
})

test('los enlaces legales usan rutas estáticas de /legal y rechazan claves desconocidas', () => {
  assert.equal(urlLegal('privacidad'), '/legal/privacidad.html')
  assert.equal(urlLegal('eliminacion'), '/legal/eliminacion-datos.html')
  assert.equal(documentoLegal('compras').titulo, 'Condiciones de compra')
  assert.throws(() => urlLegal('inventado'), /desconocido/)
})
