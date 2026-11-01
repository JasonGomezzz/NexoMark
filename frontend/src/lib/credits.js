/**
 * Modelo de créditos/planes — fuente única para CreditsExhausted y PlanesModal.
 * Pasarela de pago simulada: PlanesModal compra créditos vía
 * POST /api/campaigns/credits/purchase/ (siempre aprueba, sin procesador
 * real). `key` debe coincidir con CREDIT_PLAN_MAP en
 * backend/apps/campaigns/views.py — mantener ambos en sincronía manual.
 * La recarga manual del SuperAdmin (HU24, reset-quota) sigue existiendo
 * como vía alternativa.
 */
export const MSG_RESET =
  'Avísale a tu SuperAdmin: él restablece tu cuota a 100 desde el panel Usuarios.'

export const PLANS = [
  { key: 'basico', nombre: 'Freelance', precio: 79, creditos: '500', popular: false },
  { key: 'pro', nombre: 'Agencia', precio: 199, creditos: '1,500', popular: true },
  { key: 'elite', nombre: 'Agencia Plus', precio: 399, creditos: '5,000', popular: false },
]
