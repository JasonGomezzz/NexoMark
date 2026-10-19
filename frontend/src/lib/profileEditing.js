/** Only an explicit, valid edit may be submitted; typing never persists a profile. */
export function profileEditState({ draft, saved, editing, saving, avatarChanged = false }) {
  const name = (draft || '').trim()
  const dirty = name !== (saved || '').trim() || avatarChanged
  const valid = name.length >= 2 && name.length <= 150
  return { name, dirty, valid, canSave: Boolean(editing && !saving && dirty && valid) }
}
