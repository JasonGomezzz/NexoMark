/**
 * Texto en esqueleto: `lineas` renglones de `alto` px cada uno, la misma medida que el
 * texto real (tamaño × interlineado), para que el contenido que llega no mueva nada.
 * Si en el teléfono el texto real ocupa otro número de renglones, `movil` lo dice
 * (se usa por debajo del punto `sm`, 640 px).
 * La barra de cada renglón es más baja que el renglón: se ve como texto, no como un bloque.
 * El último renglón queda más corto, como el final de un párrafo.
 */
function Renglones({ lineas, alto, ancho, className }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: lineas }, (_, i) => (
        <div key={i} className="flex items-center" style={{ height: alto }}>
          <span className={`esqueleto block h-3 rounded ${i === lineas - 1 && lineas > 1 ? 'w-3/5' : ancho}`} />
        </div>
      ))}
    </div>
  )
}

export function LineasEsqueleto({ lineas = 1, movil, alto = 20, ancho = 'w-full', className = '' }) {
  if (movil == null || movil === lineas) {
    return <Renglones lineas={lineas} alto={alto} ancho={ancho} className={className} />
  }
  return (
    <>
      <Renglones lineas={movil} alto={alto} ancho={ancho} className={`sm:hidden ${className}`} />
      <Renglones lineas={lineas} alto={alto} ancho={ancho} className={`hidden sm:block ${className}`} />
    </>
  )
}

const ALTURAS_BARRAS = ['55%', '90%', '40%', '75%', '30%', '60%']

/** Un gráfico de barras sin datos, de `alto` px exactos: la forma de lo que viene, no una losa. */
export function BarrasEsqueleto({ alto = 250, className = '' }) {
  return (
    <div className={`flex items-end gap-5 px-3 ${className}`} style={{ height: alto }} aria-hidden="true">
      {ALTURAS_BARRAS.map((h, i) => (
        <span key={i} className="esqueleto block flex-1 rounded-t" style={{ height: h, maxWidth: 36 }} />
      ))}
    </div>
  )
}
