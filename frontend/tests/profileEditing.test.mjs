import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { profileEditState } from '../src/lib/profileEditing.js'

const baseline = { draft: 'Nuevo Nombre', saved: 'Nombre original', editing: true, saving: false }

test('only explicit valid edits can be saved', () => {
  assert.equal(profileEditState(baseline).canSave, true)
  for (const changes of [{ editing: false }, { saving: true }, { draft: '' }, { draft: '  ' },
    { draft: 'A' }, { draft: 'x'.repeat(151) }, { draft: 'Nombre original' }, { draft: ' Nombre original ' }]) {
    assert.equal(profileEditState({ ...baseline, ...changes }).canSave, false)
  }
  assert.equal(profileEditState({ ...baseline, draft: ' Nuevo Nombre ' }).name, 'Nuevo Nombre')
})

test('profile form locks by default and only sends requests after guarded submit', () => {
  const source = readFileSync(new URL('../src/pages/AccountSettingsPage.jsx', import.meta.url), 'utf8')
  assert.match(source, /\[editingProfile, setEditingProfile\] = useState\(false\)/)
  assert.match(source, /\{editingProfile \? <label className="block">/)
  assert.match(source, /disabled=\{savingProfile\}/)
  assert.match(source, /<p className="break-words text-sm font-medium text-on-surface">\{user.nombre \|\| '—'\}<\/p>/)
  assert.doesNotMatch(source, /readOnly=/)
  assert.match(source, /if \(!edit.canSave \|\| profileRequest.current\) return/)
  assert.match(source, /onSubmit=\{handleSaveProfile\}/)
  assert.match(source, /type="button".*onClick=\{handleCancelProfile\}>Cancelar/)
  assert.match(source, /setNombre\(user.nombre \|\| ''\)/)
  assert.doesNotMatch(source, /onBlur=|setTimeout\([^]*api.patch/)
  assert.equal((source.match(/api.patch\('/g) || []).length, 1)
})
