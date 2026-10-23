import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChartColumnIncreasing, ExternalLink, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RedIcon from './RedIcon'
import { REDES_META, estadoPublicacion, etiquetaRed, puedeReintentar } from '../../services/social'
import { socialApi } from '../../services/socialApi'

const TONOS = {
  ok: 'bg-success/10 text-success',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
}

/**
 * Estado de publicación por cuenta destino, con "Publicar ahora / Reintentar" para el marketero.
 * Las publicaciones en X se muestran en "Versión para X" (XVariantPanel) y los envíos a TikTok en
 * "Enviar a TikTok" (TikTokPanel): ninguna de las dos se publica al aprobar.
 */
export default function PublicationsPanel({ campaignId, estadoCampana }) {
  const [todas, setPublicaciones] = useState([])
  const [publicando, setPublicando] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    socialApi
      .publicaciones(campaignId)
      .then((lista) => vigente && setPublicaciones(lista))
      .catch(() => vigente && setPublicaciones([]))
    return () => {
      vigente = false
    }
  }, [campaignId, estadoCampana, recarga])

  const publicaciones = todas.filter((p) => REDES_META.includes(p.red))
  if (!publicaciones.length) return null

  async function publicar(publicacion) {
    setPublicando(publicacion.id)
    try {
      await socialApi.publicar(publicacion.id)
      toast.success(`Publicado en ${publicacion.cuenta_nombre}`)
    } catch (err) {
      const detalle = err.response?.data?.data?.publicacion?.error
      toast.error(detalle || err.response?.data?.message || 'No se pudo publicar.')
    } finally {
      setPublicando(null)
      setRecarga((n) => n + 1)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-on-surface">Publicación en redes</p>
      <ul className="space-y-3">
        {publicaciones.map((p) => {
          const estado = estadoPublicacion(p.estado)
          return (
            <li key={p.id} className="rounded-lg border border-outline-variant px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <RedIcon red={p.red} className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-on-surface">{p.cuenta_nombre}</span>
                <span className="text-xs text-on-surface-variant">{etiquetaRed(p.red)}</span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS[estado.tono]}`}>
                  {estado.texto}
                </span>
              </div>
              {p.error && <p className="mt-2 text-xs text-error">{p.error}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {p.permalink && (
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver publicación
                  </a>
                )}
                {p.estado === 'publicado' && (
                  <Link
                    to={`/stats?publicacion=${p.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <ChartColumnIncreasing className="h-4 w-4" />
                    Ver estadísticas
                  </Link>
                )}
                {puedeReintentar(p, estadoCampana) && (
                  <Button size="sm" variant="outline" onClick={() => publicar(p)} disabled={publicando === p.id}>
                    {publicando === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {p.estado === 'fallido' ? 'Reintentar' : 'Publicar ahora'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
