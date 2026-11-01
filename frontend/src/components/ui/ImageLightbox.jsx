import { useEffect, useState } from 'react'
import { Download, Maximize2, X } from 'lucide-react'

/**
 * Imagen compacta con lightbox a pantalla completa.
 * Vista normal: contenida a max-h-[400px] con caption y descarga.
 * `variante="post"`: a todo el ancho y sin fila de ayuda, para mostrar la pieza
 * como saldrá publicada. Clic/Enter → velo marino con la imagen a 90vh/90vw;
 * Esc / clic-fuera / X cierran. Sin desenfoque (no se usa vidrio).
 * El texto/alt viene de datos propios (no HTML crudo) — escapado JSX normal.
 */
export default function ImageLightbox({ src, alt, downloadName, variante = 'normal' }) {
  const post = variante === 'post'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Vista compacta */}
      <div className={post ? '' : 'space-y-2'}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ver imagen a pantalla completa"
          className={`group relative block w-full cursor-zoom-in overflow-hidden bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${post ? '' : 'rounded-[10px]'}`}
        >
          <img
            src={src}
            alt={alt}
            className={post ? 'block h-auto w-full' : 'mx-auto max-h-[400px] w-auto object-contain'}
          />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-navy-deep/80 px-3 py-1.5 text-[13px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            Pantalla completa
          </span>
        </button>
        <div className={post ? 'sr-only' : 'flex items-center justify-between'}>
          <p className="text-[13px] text-on-surface-variant">Clic en la imagen para ampliarla</p>
          <a
            href={src}
            download={downloadName}
            className="-my-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Download className="h-4 w-4" />
            Descargar PNG
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Imagen a pantalla completa'}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/90 p-4"
        >
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar imagen"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" />
          </button>
          <a
            href={src}
            download={downloadName}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 border border-white/15 bg-navy-deep/90 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Descargar PNG
          </a>
        </div>
      )}
    </>
  )
}
