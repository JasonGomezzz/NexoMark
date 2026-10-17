import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { AlertCircle, Info, Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { leerRetornoMeta } from '../../services/social'

function estadoInicial(retorno, mensajeMotivo) {
  if (retorno.tipo === 'codigo') return { fase: 'conectando' }
  return {
    fase: retorno.motivo === 'cancelado' ? 'info' : 'error',
    texto: mensajeMotivo(retorno.motivo),
  }
}

/**
 * Retorno del login de una red (Meta o X): /redes/<red>-retorno#code=...&state=...
 * Django no canjea el código en el callback: esta página, con la sesión del
 * usuario, lo envía junto al state y Django comprueba que la conexión la
 * inició esta misma cuenta. El fragmento se borra del historial al leerlo.
 */
export default function RetornoConexion({ titulo, textoConectando, mensajeMotivo, completar, mensajeExito }) {
  const navigate = useNavigate()
  // Se lee una sola vez, antes de que el efecto borre el fragmento.
  const [retorno] = useState(() => leerRetornoMeta(window.location.hash))
  const [estado, setEstado] = useState(() => estadoInicial(retorno, mensajeMotivo))
  const enviado = useRef(false)

  useEffect(() => {
    if (window.location.hash) {
      // El code y el state no deben quedar en la barra de direcciones ni en el historial.
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
    if (retorno.tipo !== 'codigo' || enviado.current) return
    enviado.current = true
    completar(retorno.code, retorno.state)
      .then((data) => {
        toast.success(mensajeExito(data))
        navigate('/settings', { replace: true })
      })
      .catch((err) =>
        setEstado({
          fase: 'error',
          texto: err.response?.data?.message || 'No se pudo conectar la cuenta. Vuelve a intentarlo.',
        }),
      )
  }, [retorno, navigate, completar, mensajeExito])

  const Icono = estado.fase === 'info' ? Info : AlertCircle

  return (
    <div className="max-w-xl">
      <section className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm">
        <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-on-surface">
          <Link2 className="h-5 w-5 text-primary" />
          {titulo}
        </h1>

        {estado.fase === 'conectando' ? (
          <p className="mt-4 flex items-center gap-3 text-sm text-on-surface-variant" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {textoConectando}
          </p>
        ) : (
          <>
            <p
              className={`mt-4 flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
                estado.fase === 'info'
                  ? 'bg-surface-container-low text-on-surface-variant'
                  : 'bg-error-container text-on-error-container'
              }`}
              role={estado.fase === 'error' ? 'alert' : 'status'}
            >
              <Icono className="mt-0.5 h-4 w-4 shrink-0" />
              {estado.texto}
            </p>
            <Button variant="outline" className="mt-5" onClick={() => navigate('/settings', { replace: true })}>
              Volver a Redes conectadas
            </Button>
          </>
        )}
      </section>
    </div>
  )
}
