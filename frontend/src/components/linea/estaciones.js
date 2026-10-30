/**
 * La línea: el recorrido de una campaña como cinco estaciones.
 * Dictar → Generar → Aprobar → Publicar → Medir.
 *
 * Módulo puro (sin React ni íconos) para poder probarlo con node --test.
 * Cada rol recorre su tramo: el marketero la línea completa, el superadmin
 * todo menos Dictar (no crea campañas) y el cliente solo su parte.
 */

export const ESTACIONES = {
  dictar: { id: 'dictar', nombre: 'Dictar' },
  generar: { id: 'generar', nombre: 'Generar' },
  aprobar: { id: 'aprobar', nombre: 'Aprobar' },
  publicar: { id: 'publicar', nombre: 'Publicar' },
  medir: { id: 'medir', nombre: 'Medir' },
}

const RUTAS_STAFF = {
  dictar: '/campaigns/new',
  generar: '/campaigns?etapa=generar',
  aprobar: '/campaigns?etapa=aprobar',
  publicar: '/campaigns?etapa=publicar',
  medir: '/stats',
}

const RUTAS_CLIENTE = {
  aprobar: '/client-campaigns',
  publicar: '/client-campaigns?etapa=publicar',
  medir: '/stats',
}

const TRAMO = {
  marketero: ['dictar', 'generar', 'aprobar', 'publicar', 'medir'],
  superadmin: ['generar', 'aprobar', 'publicar', 'medir'],
  cliente: ['aprobar', 'publicar', 'medir'],
}

/** Estaciones visibles para un rol, con la ruta a la que lleva cada una. */
export function estacionesDeRol(rol) {
  const tramo = TRAMO[rol] ?? TRAMO.cliente
  const rutas = rol === 'cliente' || !TRAMO[rol] ? RUTAS_CLIENTE : RUTAS_STAFF
  return tramo.map((id) => ({ ...ESTACIONES[id], to: rutas[id] }))
}

/** Etapa de la línea en la que está una campaña según su estado FSM. */
export function etapaDeEstado(estado) {
  switch (estado) {
    case 'borrador':
    case 'pendiente_ia':
    case 'generado':
    case 'rechazado':
      return 'generar'
    case 'pendiente_aprobacion':
      return 'aprobar'
    case 'aprobado':
      return 'publicar'
    default:
      return null // fracaso u otro estado final fuera del recorrido
  }
}

/** Estados FSM que pertenecen a cada etapa (para filtrar listas). */
export const ESTADOS_DE_ETAPA = {
  generar: ['borrador', 'pendiente_ia', 'generado', 'rechazado'],
  aprobar: ['pendiente_aprobacion'],
  publicar: ['aprobado'],
}

/** Estación actual según la ruta. Una página puede afinarla (ver EstacionContext). */
export function estacionDeRuta(pathname, search = '') {
  const etapa = new URLSearchParams(search).get('etapa')
  if (pathname === '/campaigns/new') return 'dictar'
  if (pathname === '/campaigns' || pathname === '/client-campaigns') {
    if (etapa && ESTACIONES[etapa]) return etapa
    return pathname === '/client-campaigns' ? 'aprobar' : null
  }
  if (pathname.startsWith('/review/')) return 'aprobar'
  if (pathname === '/stats') return 'medir'
  return null
}

/**
 * Conteo por estación. Personal: /api/campaigns/stats/ (conteo por estado).
 * Cliente: /api/v1/campaigns/summary de Spring (pendientes, aprobadas).
 * Un dato que no llegó queda en null (no se muestra), nunca en 0.
 */
export function conteosDeLinea(rol, datos) {
  if (!datos) return {}
  if (rol === 'cliente') {
    return { aprobar: datos.pendientes ?? null, publicar: datos.aprobadas ?? null }
  }
  const suma = (estados) => estados.reduce((total, estado) => total + (datos[estado] ?? 0), 0)
  return {
    generar: suma(ESTADOS_DE_ETAPA.generar),
    aprobar: suma(ESTADOS_DE_ETAPA.aprobar),
    publicar: suma(ESTADOS_DE_ETAPA.publicar),
  }
}
