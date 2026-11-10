import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

test('cerrar sesión pide confirmación antes de salir, en escritorio y en el cajón móvil', () => {
  const layout = leer('../src/components/AppLayout.jsx')
  // Los dos botones «Cerrar sesión» abren la confirmación…
  assert.equal((layout.match(/onLogout=\{pedirSalida\}/g) ?? []).length, 2)
  assert.doesNotMatch(layout, /onLogout=\{handleLogout\}/)
  // …y solo el botón del diálogo ejecuta el cierre real.
  assert.match(layout, /<ConfirmDialog[\s\S]*onConfirm=\{handleLogout\}/)
})

test('el diálogo de confirmación usa <dialog> modal y no se cierra mientras trabaja', () => {
  const dialogo = leer('../src/components/ui/ConfirmDialog.jsx')
  assert.match(dialogo, /\.showModal\(\)/)
  assert.match(dialogo, /onCancel=\{\(evento\) => \{[\s\S]*if \(!ocupado\) onCancel\(\)/)
  assert.match(dialogo, /disabled=\{ocupado\}/)
})
