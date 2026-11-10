import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

test('el panel de marca se compacta por alto y nunca crece más que la ventana', () => {
  const css = leer('../src/index.css')
  for (const variante of ['alto-medio', 'alto-corto', 'alto-minimo']) {
    assert.match(css, new RegExp(`@custom-variant ${variante} \\(@media \\(max-height: \\d+px\\)\\)`))
  }
  const panel = leer('../src/components/auth/AuthBrandPanel.jsx')
  assert.match(panel, /sticky top-0[^"]*h-dvh/)
  assert.doesNotMatch(panel, /min-h-screen/)
  assert.match(panel, /alto-minimo:hidden/)
})
