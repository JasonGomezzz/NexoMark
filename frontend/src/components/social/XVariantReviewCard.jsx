import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CircleCheck, CircleX, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RejectModal from '@/components/campaign/RejectModal'
import RedIcon from './RedIcon'
import { estadoPublicacion } from '../../services/social'
import { socialApi } from '../../services/socialApi'
import { MAXIMO_X, TONOS_X, estadoVarianteX } from '../../services/xTexto'

const TITULOS = {
  pendiente_cliente: 'Versión para X pendiente de tu aprobación',
  aprobada: 'Versión para X aprobada',
  rechazada: 'Versión para X rechazada',
}

const MOTIVOS_X = ['El texto no convence', 'Falta información', 'Tono equivocado', 'No refleja la campaña']

/**
 * Tarjeta del cliente para la versión corta de X de una campaña ya aprobada.
 * Muestra el texto EXACTO que se publicará y la imagen que lo acompaña. Al
 * aprobar se envía el hash del texto que está en pantalla: si el marketero lo
 * cambió entretanto, el servidor no lo aprueba. No se muestra si X está apagada.
 */
export default function XVariantReviewCard({ campaignId, imagenB64, titulo }) {
  const [habilitado, setHabilitado] = useState(false)
  const [variante, setVariante] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    socialApi
      .xConfig()
      .then(async (config) => {
        if (!vigente) return
        setHabilitado(Boolean(config.habilitado))
        if (!config.habilitado) return
        const lista = await socialApi.variantesX({ campaign: campaignId })
        if (vigente) setVariante(lista[0] ?? null)
      })
      .catch(() => vigente && setVariante(null))
    return () => {
      vigente = false
    }
  }, [campaignId, recarga])

  if (!habilitado || !variante) return null

  const estado = estadoVarianteX(variante.estado)
  const pendiente = variante.estado === 'pendiente_cliente'

  async function decidir(operacion, exito) {
    setBusy(true)
    try {
      const respuesta = await operacion()
      setVariante(respuesta.data.variante)
      setRechazando(false)
      toast.success(exito)
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo guardar tu decisión.')
      // 409: el marketero cambió el texto o ya no está pendiente: se recarga lo vigente.
      if (err.response?.status === 409) setRecarga((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby={`variante-x-${variante.id}`}
      className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <RedIcon red="x" className="h-4 w-4 text-on-surface" />
        <h2 id={`variante-x-${variante.id}`} className="text-base font-semibold text-on-surface">
          {TITULOS[variante.estado] ?? 'Versión para X'}
        </h2>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS_X[estado.tono]}`}>
          {estado.texto}
        </span>
      </div>

      {pendiente && (
        <p className="mb-4 text-sm text-on-surface-variant">
          El marketero preparó este texto corto para publicar en X con la imagen de la campaña. Se publicará
          exactamente lo que apruebes; tu campaña aprobada no cambia.
        </p>
      )}

      <p className="whitespace-pre-wrap rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 text-base leading-relaxed text-on-surface">
        {variante.texto}
      </p>
      <p className="mt-1 text-right text-xs tabular-nums text-on-surface-variant">
        {variante.longitud}/{MAXIMO_X} caracteres de X
      </p>

      {imagenB64 && (
        <figure className="mt-3">
          <img
            src={`data:image/png;base64,${imagenB64}`}
            alt={`Imagen que acompañará el post en X${titulo ? ` de ${titulo}` : ''}`}
            className="max-h-56 rounded-lg border border-outline-variant object-contain"
          />
          <figcaption className="mt-1 text-xs text-on-surface-variant">Se publicará con esta imagen.</figcaption>
        </figure>
      )}

      {variante.estado === 'rechazada' && variante.feedback_cliente && (
        <div className="mt-4 rounded-lg border border-outline-variant px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-error">Tu comentario</p>
          <p className="text-sm text-on-surface">{variante.feedback_cliente}</p>
          <p className="mt-2 text-xs text-on-surface-variant">El marketero preparará otra versión.</p>
        </div>
      )}

      {variante.estado === 'aprobada' && variante.aprobada_at && (
        <p className="mt-4 text-sm text-on-surface-variant">
          La aprobaste el {new Date(variante.aprobada_at).toLocaleDateString('es-PE')}. El marketero la publicará
          en X.
        </p>
      )}

      {variante.publicaciones?.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Publicaciones en X">
          {variante.publicaciones.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <RedIcon red="x" className="h-4 w-4 text-on-surface" />
              <span className="font-medium text-on-surface">{p.cuenta_nombre}</span>
              {p.permalink ? (
                <a
                  href={p.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver en X
                </a>
              ) : (
                <span className="ml-auto text-xs text-on-surface-variant">{estadoPublicacion(p.estado).texto}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendiente && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            className="bg-success hover:bg-success/90"
            disabled={busy}
            onClick={() =>
              decidir(() => socialApi.aprobarVarianteX(variante.id, variante.hash_texto), 'Aprobaste la versión para X.')
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
            Aprobar versión para X
          </Button>
          <Button
            variant="outline"
            className="border-error/30 text-error hover:bg-error-container/50"
            disabled={busy}
            onClick={() => setRechazando(true)}
          >
            <CircleX className="h-4 w-4" />
            Rechazar
          </Button>
        </div>
      )}

      <RejectModal
        open={rechazando}
        busy={busy}
        titulo="¿Por qué rechazas la versión para X?"
        descripcion="Tu comentario ayuda al marketero a preparar otra versión. Tu campaña aprobada no cambia."
        nota="El marketero verá tu comentario en la campaña."
        motivos={MOTIVOS_X}
        onCancel={() => setRechazando(false)}
        onConfirm={(feedback) =>
          decidir(() => socialApi.rechazarVarianteX(variante.id, feedback), 'Rechazaste la versión para X.')
        }
      />
    </section>
  )
}
