/** Valores del dominio con su nombre para mostrar (fuente única para formularios y listas). */

export const INDUSTRIAS = [
  { value: 'tecnologia', label: 'Tecnología' },
  { value: 'salud', label: 'Salud' },
  { value: 'educacion', label: 'Educación' },
  { value: 'retail', label: 'Retail' },
  { value: 'gastronomia', label: 'Gastronomía' },
  { value: 'moda', label: 'Moda' },
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'entretenimiento', label: 'Entretenimiento' },
  { value: 'otro', label: 'Otro' },
]

// Valores EXACTOS de CampaignTono/CampaignPlataforma del backend —
// un valor fuera de choices devuelve 400.
export const TONOS = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'inspiracional', label: 'Inspiracional' },
  { value: 'humoristico', label: 'Humorístico' },
  { value: 'persuasivo', label: 'Persuasivo' },
]

export const PLATAFORMAS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok' },
]

const nombre = (lista) => (valor) => lista.find((o) => o.value === valor)?.label ?? 'sin dato'
export const etiquetaIndustria = nombre(INDUSTRIAS)
export const etiquetaPlataforma = nombre(PLATAFORMAS)
export const etiquetaTono = nombre(TONOS)
