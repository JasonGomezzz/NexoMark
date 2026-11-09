/**
 * Planes y créditos de NexoMark — fuente única del frontend (landing,
 * PlanesModal, CreditsExhausted, cuenta y avisos antes de generar).
 *
 * Decisión del equipo (6 nov 2026), precios mensuales sin IGV:
 *   Freelance     S/59  · 100 créditos  · hasta 25 generaciones
 *   Agencia       S/149 · 400 créditos  · hasta 100 generaciones
 *   Agencia Plus  S/299 · 1000 créditos · hasta 250 generaciones (próximamente)
 *
 * Una generación o regeneración de texto + imagen cuesta 4 créditos. Editar,
 * enviar, aprobar, consultar y publicar en varias redes no gastan créditos. Si
 * la generación falla sin entregar contenido, se devuelven.
 *
 * El backend es la fuente de verdad (services/credit_service.py): el costo
 * real llega en `costo_generacion` (/api/auth/me/, /api/campaigns/stats/) y los
 * planes en GET /api/campaigns/credits/plans/. Estos valores son el respaldo
 * mientras carga la respuesta; `key` debe coincidir con CREDIT_PLANS.
 * Pasarela de pago simulada: no hay cobro real ni renovación automática.
 */

export const GENERATION_CREDIT_COST = 4

export const PLANS = [
  {
    key: 'freelance',
    nombre: 'Freelance',
    precio: 59,
    creditos: 100,
    disponible: true,
    destacado: false,
    para: '1 marketero independiente',
  },
  {
    key: 'agencia',
    nombre: 'Agencia',
    precio: 149,
    creditos: 400,
    disponible: true,
    destacado: true,
    para: 'Agencias pequeñas con varios clientes',
  },
  {
    key: 'agencia_plus',
    nombre: 'Agencia Plus',
    precio: 299,
    creditos: 1000,
    disponible: false,
    destacado: false,
    para: 'Próximamente: multiusuario e imagen de alta calidad',
  },
]

/** Reglas de consumo que se muestran en la landing y en la cuenta. */
export const CONSUMPTION_RULES = [
  { accion: 'Generar texto e imagen', creditos: GENERATION_CREDIT_COST },
  { accion: 'Regenerar texto e imagen', creditos: GENERATION_CREDIT_COST },
  { accion: 'Editar a mano, enviar, aprobar y consultar', creditos: 0 },
  { accion: 'Publicar el mismo contenido en varias redes', creditos: 0 },
  { accion: 'Fallo técnico sin contenido', creditos: 0, nota: 'Se devuelve lo cobrado' },
]

/** Costo vigente: el que manda el backend, o el respaldo. */
export function costoGeneracion(fuente) {
  const costo = Number(fuente?.costo_generacion)
  return Number.isInteger(costo) && costo > 0 ? costo : GENERATION_CREDIT_COST
}

/** Generaciones completas que alcanzan con `creditos` (null si no hay dato). */
export function generaciones(creditos, costo = GENERATION_CREDIT_COST) {
  if (creditos == null || Number.isNaN(Number(creditos))) return null
  return Math.floor(Math.max(Number(creditos), 0) / costo)
}

const numero = (n) => Number(n).toLocaleString('es-PE')

/** "100 créditos · hasta 25 generaciones" */
export function creditosConGeneraciones(creditos, costo = GENERATION_CREDIT_COST) {
  const g = generaciones(creditos, costo)
  if (g == null) return 'sin dato'
  return `${numero(creditos)} ${Number(creditos) === 1 ? 'crédito' : 'créditos'} · hasta ${numero(g)} ${g === 1 ? 'generación' : 'generaciones'}`
}

export function alcanzaParaGenerar(saldo, costo = GENERATION_CREDIT_COST) {
  return saldo == null || Number(saldo) >= costo
}

/** Aviso antes de generar: "Esta generación usará 4 créditos. Te quedan 96." */
export function avisoConsumo(saldo, costo = GENERATION_CREDIT_COST, accion = 'Esta generación') {
  const base = `${accion} usará ${costo} créditos.`
  if (saldo == null) return base
  return `${base} Te quedan ${numero(Math.max(Number(saldo), 0))}.`
}
