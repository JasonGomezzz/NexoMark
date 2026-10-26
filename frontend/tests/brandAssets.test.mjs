import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('web and Flutter use identical copies of the approved NexoMark icon', async () => {
  const root = new URL('../../', import.meta.url)
  const [approved, web, mobile] = await Promise.all([
    'brand/nexomark-icon-approved-1024.png',
    'frontend/public/nexomark-icon.png',
    'mobile_flutter/assets/brand/nexomark-icon.png',
  ].map(path => readFile(new URL(path, root))))
  assert.deepEqual(web, approved)
  assert.deepEqual(mobile, approved)
  assert.equal(web.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(web.readUInt32BE(16), 1024)
  assert.equal(web.readUInt32BE(20), 1024)
})

test('brand and favicon reference the approved icon rather than the old SVG', async () => {
  const root = new URL('../../', import.meta.url)
  const [logo, entry, mobile] = await Promise.all([
    'frontend/src/components/BrandLogo.jsx',
    'frontend/index.html',
    'mobile_flutter/lib/widgets/nexo_widgets.dart',
  ].map(path => readFile(new URL(path, root), 'utf8')))
  assert.match(logo, /src="\/nexomark-icon\.png"/)
  assert.match(entry, /rel="icon" type="image\/png" href="\/nexomark-icon\.png"/)
  assert.match(mobile, /Image\.asset\(\s*'assets\/brand\/nexomark-icon\.png'/)
  for (const source of [logo, entry, mobile]) assert.doesNotMatch(source, /nexomark-mark\.svg/)
})
