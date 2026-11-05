import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChartColumnIncreasing, ExternalLink, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RedIcon from './RedIcon'
import { REDES_META, estadoPublicacion, etiquetaRed, puedeReintentar } from '../../services/social'
import { socialApi } from '../../services/socialApi'

const TONOS = {
  ok: 'bg-success-container text-success',
  error: 'bg-error-container text-on-error-container',
  neutral: 'bg-surface-container-high text-on-surface-variant',
}

/**
 * Estado de publicación por cuenta destino, con "Publicar ahora / Reintentar" para el marketero.
 * Las publicaciones en X se muestran en "Versión para X" (XVariantPanel) y los envíos a TikTok en
 * "Enviar a TikTok" (TikTokPanel): ninguna de las dos se publica al aprobar.
 */
export default function PublicationsPanel({ campaignId, estadoCampana, onCargadas }) {
  // null mientras carga: "sin cuentas de destino" solo se dice cuando se sabe.
  const [todas, setPublicaciones] = useState(null)
  const [falloCarga, setFalloCarga] = useState(false)
  const [publicando, setPublicando] = useState(null)
  const [recarga, setRecarga] = useState(0)
  // El aviso al padre no debe volver a pedir la lista cada vez que el padre se redibuja.
  const avisar = useRef(onCargadas)
  useEffect(() => {
    avisar.current = onCargadas
  })

  useEffect(() => {
    let vigente = true
    socialApi
      .publicaciones(campaignId)
      .then((lista) => {
        if (!vigente) return
        setPublicaciones(lista)
        setFalloCarga(false)
        avisar.current?.(lista)
      })
      .catch(() => vigente && setFalloCarga(true))
    return () => {
      vigente = false
    }
  }, [campaignId, estadoCampana, recarga])

  const conPublicacion = ['pendiente_aprobacion', 'aprobado'].includes(estadoCampana)
  if (falloCarga && todas === null) {
    if (!conPublicacion) return null
    return (
      <section aria-labelledby="publicacion-titulo" className="regla pt-5">
        <h2 id="publicacion-titulo" className="text-2xl font-extrabold text-on-surface">
          Publicación
        </h2>
        <p role="alert" className="mt-2 text-[15px] text-on-surface-variant">
          No se pudo cargar el estado de la publicación.{' '}
          <button type="button" onClick={() => setRecarga((n) => n + 1)} className="inline-flex min-h-11 items-center font-semibold text-primary underline">
            Reintentar
          </button>
        </p>
      </section>
    )
  }
  if (todas === null) return null
  const publicaciones = todas.filter((p) => REDES_META.includes(p.red))
  if (!publicaciones.length) {
    // X y TikTok tienen su propio panel: si hay alguna, no es una campaña sin destinos.
    if (todas.length > 0 || !conPublicacion) return null
    // Enviada o aprobada sin destinos: se dice, para que nadie espere una publicación que no ocurrirá.
    return (
      <section aria-labelledby="publicacion-titulo" className="regla pt-5">
        <h2 id="publicacion-titulo" className="text-2xl font-extrabold text-on-surface">
          Publicación
        </h2>
        <p className="mt-2 text-[15px] text-on-surface-variant">
          {estadoCampana === 'aprobado'
            ? 'Se aprobó sin cuentas de destino: no se publicará sola. Publícala desde la cuenta del cliente.'
            : 'Se envió sin cuentas de destino: cuando el cliente la apruebe, no se publicará sola.'}
        </p>
      </section>
    )
  }

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
    <section aria-labelledby="publicacion-titulo" className="regla pt-5">
      <h2 id="publicacion-titulo" className="mb-4 text-2xl font-extrabold text-on-surface">
        Publicación
      </h2>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {publicaciones.map((p) => {
          const estado = estadoPublicacion(p.estado)
          return (
            <li key={p.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <RedIcon red={p.red} className="h-6 w-6 text-primary" />
                <span className="text-sm font-semibold text-on-surface">{p.cuenta_nombre}</span>
                <span className="text-[13px] text-on-surface-variant">{etiquetaRed(p.red)}</span>
                <span className={`ml-auto rounded-full px-3 py-1 text-[13px] font-semibold ${TONOS[estado.tono]}`}>
                  {estado.texto}
                </span>
              </div>
              {p.error && <p role="alert" className="mt-2 text-[13px] text-error">{p.error}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {p.permalink && (
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver publicación
                  </a>
                )}
                {p.estado === 'publicado' && (
                  <Link
                    to={`/stats?publicacion=${p.id}`}
                    className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
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
    </section>
  )
}
