import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link2, Loader2, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RedIcon from './RedIcon'
import { etiquetaRed } from '../../services/social'
import { socialApi } from '../../services/socialApi'

/**
 * "Redes conectadas": el dueño de la cuenta (cliente) o el marketero autoriza
 * su página de Facebook y su Instagram con el login de Meta. La contraseña
 * nunca pasa por MarketMind; el servidor guarda un token cifrado.
 * Al volver de Meta, /redes/meta-retorno termina la conexión y regresa aquí.
 * X es opcional: el botón solo aparece si el servidor la tiene encendida.
 */
export default function SocialConnectionsCard() {
  const [conexiones, setConexiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [conectando, setConectando] = useState(null)
  const [xHabilitado, setXHabilitado] = useState(false)

  useEffect(() => {
    let vigente = true
    socialApi
      .conexiones()
      .then((lista) => vigente && setConexiones(lista))
      .catch(() => vigente && toast.error('No se pudieron cargar las redes conectadas.'))
      .finally(() => vigente && setCargando(false))
    socialApi
      .xConfig()
      .then((config) => vigente && setXHabilitado(Boolean(config.habilitado)))
      .catch(() => vigente && setXHabilitado(false))
    return () => {
      vigente = false
    }
  }, [])

  async function conectar(red) {
    setConectando(red)
    try {
      window.location.assign(await (red === 'x' ? socialApi.urlConexionX() : socialApi.urlConexion()))
    } catch (err) {
      toast.error(
        err.response?.data?.message || `No se pudo iniciar la conexión con ${red === 'x' ? 'X' : 'Meta'}.`,
      )
      setConectando(null)
    }
  }

  async function desconectar(conexion) {
    try {
      await socialApi.desconectar(conexion.id)
      setConexiones((actuales) => actuales.filter((c) => c.id !== conexion.id))
      toast.success(`${conexion.cuenta_nombre} desconectada.`)
    } catch {
      toast.error('No se pudo desconectar la cuenta.')
    }
  }

  return (
    <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold text-on-surface">
        <Link2 className="h-5 w-5 text-primary" />
        Redes conectadas
      </h2>
      <p className="mb-5 text-sm text-on-surface-variant">
        Conecta tu página de Facebook y su cuenta de Instagram profesional. Las campañas aprobadas se
        publican en las cuentas que elija el marketero al enviarlas.
      </p>
      {xHabilitado && (
        <p className="-mt-3 mb-5 text-sm text-on-surface-variant">
          X es opcional y no se publica al aprobar: el marketero prepara una versión corta, la apruebas y
          recién entonces se publica, con un costo por post.
        </p>
      )}

      {cargando ? (
        <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
      ) : conexiones.length === 0 ? (
        <p className="mb-5 rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Todavía no hay cuentas conectadas.
        </p>
      ) : (
        <ul className="mb-5 divide-y divide-outline-variant rounded-lg border border-outline-variant">
          {conexiones.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <RedIcon red={c.red} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-on-surface">{c.cuenta_nombre}</p>
                <p className="text-xs text-on-surface-variant">{etiquetaRed(c.red)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => desconectar(c)}>
                <Unlink className="h-4 w-4" />
                Desconectar
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        {/* En pantallas angostas el texto largo del botón se parte en dos líneas en vez de desbordar la tarjeta. */}
        <Button
          className="h-auto min-h-11 whitespace-normal py-2 text-left"
          onClick={() => conectar('meta')}
          disabled={conectando !== null}
        >
          {conectando === 'meta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {conexiones.some((c) => c.red !== 'x') ? 'Conectar otra cuenta' : 'Conectar Instagram y Facebook'}
        </Button>
        {xHabilitado && (
          <Button variant="outline" onClick={() => conectar('x')} disabled={conectando !== null}>
            {conectando === 'x' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RedIcon red="x" />}
            Conectar X
          </Button>
        )}
      </div>
    </section>
  )
}
