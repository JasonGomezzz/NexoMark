import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir, access, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareLegalSite, ROOT_FILES } from './prepare-legal-site.mjs'

const REAL_SOURCE = fileURLToPath(new URL('../legal-site/', import.meta.url))
const PAGES = [
  'index.html', 'privacidad.html', 'terminos.html', 'cookies.html', 'compras.html', 'arrepentimiento.html',
  'reclamos.html', 'responsables.html', 'eliminacion-datos.html',
]

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexomark-legal-test-'))
  const source = path.join(root, 'source')
  const target = path.join(root, 'output')
  await mkdir(path.join(source, 'historial'), { recursive: true })
  for (const name of PAGES) {
    await writeFile(path.join(source, name), '<html>BORRADOR <a href="styles.css">Estilo</a></html>')
  }
  await writeFile(path.join(source, 'styles.css'), 'body { color: black }')
  await writeFile(path.join(source, '.env'), 'DO_NOT_DEPLOY')
  await writeFile(path.join(source, 'README.md'), 'Internal instructions')
  await writeFile(path.join(source, 'historial', 'privacidad-v0.1-2026-10-11.html'), '<html>Historial</html>')
  return { source, target }
}

test('draft publication blocked by default without creating output', async () => {
  const input = await fixture()
  await assert.rejects(prepareLegalSite(input), /Publicación bloqueada/)
  await assert.rejects(access(input.target))
})
test('explicit draft preparation copies only the allowed public files', async () => {
  const input = await fixture()
  const result = await prepareLegalSite({ ...input, allowDrafts: true })
  assert.equal(result.drafts, true)
  assert.deepEqual((await readdir(input.target)).sort(), ['.nojekyll', ...PAGES, 'historial', 'styles.css'].sort())
  await assert.rejects(access(path.join(input.target, '.env')))
  await assert.rejects(access(path.join(input.target, 'README.md')))
})
test('existing output cannot be overwritten', async () => {
  const input = await fixture()
  await mkdir(input.target)
  await assert.rejects(prepareLegalSite({ ...input, allowDrafts: true }), /no se sobrescribe/)
})
test('links to files excluded from deployment fail before creating output', async () => {
  const input = await fixture()
  await writeFile(path.join(input.source, 'index.html'), '<a href="README.md">No publicar</a>')
  await assert.rejects(prepareLegalSite({ ...input, allowDrafts: true }), /fuera del sitio/)
  await assert.rejects(access(input.target))
})
test('data deletion page is required before creating output', async () => {
  const input = await fixture()
  await rm(path.join(input.source, 'eliminacion-datos.html'))
  await assert.rejects(prepareLegalSite({ ...input, allowDrafts: true }), /ENOENT/)
  await assert.rejects(access(input.target))
})
test('the real legal site prepares with valid links and the deletion page', async () => {
  assert.ok(ROOT_FILES.includes('eliminacion-datos.html'))
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexomark-legal-real-'))
  const target = path.join(root, 'output')
  const result = await prepareLegalSite({ source: REAL_SOURCE, target, allowDrafts: true })
  for (const name of PAGES) assert.ok(result.files.includes(name), `${name} falta en el sitio`)
  assert.ok(!result.files.some(name => /\.md$/i.test(name)), 'no se publican archivos Markdown')
  for (const name of ['index.html', 'privacidad.html', 'terminos.html']) {
    const html = await readFile(path.join(target, name), 'utf8')
    assert.match(html, /href="eliminacion-datos\.html"/, `${name} debe enlazar la eliminación de datos`)
  }
})
test('todos los documentos actuales se enlazan entre sí en la navegación y nada apunta a una versión vieja', async () => {
  const destinos = ['privacidad.html', 'terminos.html', 'cookies.html', 'compras.html', 'reclamos.html', 'responsables.html', 'eliminacion-datos.html']
  for (const name of PAGES.filter(page => page !== 'index.html')) {
    const html = await readFile(path.join(REAL_SOURCE, name), 'utf8')
    const nav = html.match(/<nav aria-label="Documentos">(.*?)<\/nav>/s)?.[1] ?? ''
    for (const destino of destinos) assert.ok(nav.includes(`href="${destino}"`), `${name} debe enlazar ${destino} en la navegación`)
    assert.doesNotMatch(html, /BORRADOR v0\.1[0-3] /, `${name} conserva el aviso de una versión vieja`)
  }
})
test('los documentos nuevos dicen que la compra es simulada y no inventan datos de empresa', async () => {
  const compras = await readFile(path.join(REAL_SOURCE, 'compras.html'), 'utf8')
  assert.match(compras, /La compra es simulada: no se cobra nada/)
  const responsables = await readFile(path.join(REAL_SOURCE, 'responsables.html'), 'utf8')
  assert.match(responsables, /no es una empresa ni un servicio comercial/)
  assert.doesNotMatch(responsables, /RUC\s*(N\.?°|:)?\s*\d{11}/)
})
test('cada historial v0.13 conserva enlaces válidos dentro del sitio', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexomark-legal-historial-'))
  const result = await prepareLegalSite({ source: REAL_SOURCE, target: path.join(root, 'output'), allowDrafts: true })
  for (const name of ['historial/privacidad-v0.13-2026-10-22.html', 'historial/terminos-v0.13-2026-10-22.html']) {
    assert.ok(result.files.includes(name), `${name} falta en el sitio`)
  }
})
