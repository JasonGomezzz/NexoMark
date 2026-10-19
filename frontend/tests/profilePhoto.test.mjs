import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { profilePhotoError, MAX_PROFILE_PHOTO_BYTES } from '../src/lib/profilePhoto.js'
import { profileEditState } from '../src/lib/profileEditing.js'

test('photo input only accepts bounded JPEG PNG and WebP', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(profilePhotoError({ type, size: MAX_PROFILE_PHOTO_BYTES }), '')
  }
  assert.ok(profilePhotoError({ type: 'image/svg+xml', size: 100 }))
  assert.ok(profilePhotoError({ type: 'image/jpeg', size: MAX_PROFILE_PHOTO_BYTES + 1 }))
})

test('photo-only changes still require explicit valid edit and save', () => {
  const baseline = { draft: 'Nombre', saved: 'Nombre', editing: true, saving: false, avatarChanged: true }
  assert.equal(profileEditState(baseline).canSave, true)
  assert.equal(profileEditState({ ...baseline, editing: false }).canSave, false)
  assert.equal(profileEditState({ ...baseline, saving: true }).canSave, false)
})

test('profile photo uses authenticated blobs and cancel only clears draft', () => {
  const avatar = readFileSync(new URL('../src/components/ProfileAvatar.jsx', import.meta.url), 'utf8')
  assert.match(avatar, /api.get\('\/api\/auth\/me\/avatar\/', \{ responseType: 'blob' \}\)/)
  assert.match(avatar, /URL.revokeObjectURL/)
  const page = readFileSync(new URL('../src/pages/AccountSettingsPage.jsx', import.meta.url), 'utf8')
  assert.match(page, /payload.append\('avatar', avatarFile\)/)
  assert.match(page, /payload.append\('remove_avatar', 'true'\)/)
  assert.match(page, /function handleCancelProfile\(\)[^]*?resetPhotoDraft\(\)/)
  assert.match(page, /window.dispatchEvent\(new Event\('profile-updated'\)\)/)
})
