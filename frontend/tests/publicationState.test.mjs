import test from 'node:test'
import assert from 'node:assert/strict'
import { registeredPublicationLabel } from '../src/services/publicationState.js'
import { canConfirmFacebookPublication } from '../src/services/facebookPublication.js'

test('historical, missing and unresolved states never offer another Facebook publish', () => {
  const campaign = { estado: 'aprobado', plataformas: ['facebook'], texto_generado: 'Aprobado', imagen_b64: 'image' }
  for (const status of ['published', 'removed', 'unavailable', 'pending_previous', 'uncertain', 'publishing']) {
    assert.ok(registeredPublicationLabel(status))
    assert.equal(canConfirmFacebookPublication(campaign, '1', { outcome: { status } }), false)
  }
  assert.equal(canConfirmFacebookPublication(campaign, '1', { outcome: { status: 'not_published' } }), true)
})
