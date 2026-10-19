// Use the saved, approved copy, never an unsaved local draft.
export function getPlatformCopy(campaign, platform) {
  return campaign?.textos_por_plataforma?.[platform] ?? campaign?.texto_generado ?? ''
}

export function getApprovedPublicationCopy(campaign, platform) {
  if (['linkedin', 'google_ads'].includes(platform)) return null
  if (campaign?.estado !== 'aprobado') return null
  const copy = platform ? getPlatformCopy(campaign, platform) : campaign.texto_generado
  return typeof copy === 'string' && copy.trim() ? copy : null
}
