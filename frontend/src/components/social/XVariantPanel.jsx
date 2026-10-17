import { useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, ExternalLink, Loader2, Save, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RedIcon from './RedIcon'
import { estadoPublicacion } from '../../services/social'
import { socialApi } from '../../services/socialApi'
import {
  MAXIMO_X,
  TONOS_X,
  estadoVarianteX,
  puedePublicarX,
  textoConfirmacionCosto,
  validarTextoX,
} from '../../services/xTexto'

const mensajeDe = (err, porDefecto) => err.response?.data?.message || porDefecto

/**
 * "Versión para X" del marketero en una campaña aprobada (X opcional).
 * Regla de oro: el cliente aprueba este texto aparte (la campaña aprobada no se
 * reabre); al publicar, el servidor compara el hash del texto con el aprobado,
 * exige confirmar el costo y respeta el tope de gasto mensual.
 */
export default function XVariantPanel({ campaign }) {
  const [config, setConfig] = useState(null)
  const [variante, setVariante] = useState(null)
  const [texto, setTexto] = useState('')
  const [cuentas, setCuentas] = useState([])
  const [cuentaId, setCuentaId] = useState(null)
  const [confirmoCosto, setConfirmoCosto] = useState(false)
  const [revisado, setRevisado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [ocupado, setOcupado] = useState(null)
  const textareaRef = useRef(null)
  const id = useId()

  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const c = await socialApi.xConfig()
        if (!vigente) return
        setConfig(c)
        if (!c.habilitado) return
        const [lista, destinos] = await Promise.all([
          socialApi.variantesX({ campaign: campaign.id }),
          socialApi.destinosX(campaign.id),
        ])
        if (!vigente) return
        setVariante(lista[0] ?? null)
        setTexto(lista[0]?.texto ?? '')
        setCuentas(destinos)
        if (destinos.length === 1) setCuentaId(destinos[0].id)
      } catch {
        if (vigente) setError(true)
      } finally {
        if (vigente) setCargando(false)
      }
    }
    cargar()
    return () => {
      vigente = false
    }
  }, [campaign.id])

  if (cargando || !config?.habilitado) return null

  const validacion = validarTextoX(texto)
  const sinGuardar = texto !== (variante?.texto ?? '')
  const estado = variante ? estadoVarianteX(variante.estado) : null
  const bloqueada = Boolean(variante?.bloqueada)
  const publicaciones = variante?.publicaciones ?? []
  const publicadas = new Set(publicaciones.filter((p) => p.estado === 'publicado').map((p) => p.cuenta_nombre))
  const incierta = publicaciones.find((p) => p.resultado_incierto)
  const puedeEnviar = variante && ['borrador', 'rechazada'].includes(variante.estado) && !sinGuardar && !bloqueada
  const listoParaPublicar =
    puedePublicarX(variante, config, cuentaId, confirmoCosto) && !sinGuardar && (!incierta || revisado)

  function aplicar(respuesta) {
    const nueva = respuesta.data.variante
    setVariante(nueva)
    setTexto(nueva.texto)
  }

  async function ejecutar(accion, operacion, porDefecto) {
    setOcupado(accion)
    try {
      const respuesta = await operacion()
      aplicar(respuesta)
      toast.success(respuesta.message)
      return true
    } catch (err) {
      toast.error(mensajeDe(err, porDefecto))
      return false
    } finally {
      setOcupado(null)
    }
  }

  async function resumir() {
    const ok = await ejecutar('resumir', () => socialApi.crearVarianteX(campaign.id), 'No se pudo preparar el resumen.')
    if (ok) textareaRef.current?.focus()
  }

  function guardar() {
    return ejecutar(
      'guardar',
      () => (variante ? socialApi.editarVarianteX(variante.id, texto) : socialApi.crearVarianteX(campaign.id, texto)),
      'No se pudo guardar el texto para X.',
    )
  }

  function enviar() {
    return ejecutar('enviar', () => socialApi.enviarVarianteX(variante.id), 'No se pudo enviar al cliente.')
  }

  async function publicar() {
    setOcupado('publicar')
    try {
      const respuesta = await socialApi.publicarVarianteX(variante.id, {
        conexion: cuentaId,
        confirmoCosto,
        confirmoRevision: revisado,
      })
      toast.success(respuesta.message)
      setVariante(respuesta.data.variante)
      setConfig((actual) => ({ ...actual, ...respuesta.data.gasto }))
    } catch (err) {
      const data = err.response?.data?.data
      toast.error(mensajeDe(err, 'No se pudo publicar en X.'))
      if (data?.variante) setVariante(data.variante)
      if (data?.gasto) setConfig((actual) => ({ ...actual, ...data.gasto }))
    } finally {
      setConfirmoCosto(false)
      setRevisado(false)
      setOcupado(null)
    }
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="mt-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm"
    >
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <RedIcon red="x" className="h-4 w-4" />
        <h2 id={`${id}-titulo`} className="text-sm font-semibold text-on-surface">
          Versión para X
        </h2>
        {estado && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONOS_X[estado.tono]}`}>
            {estado.texto}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-on-surface-variant">
        Opcional. El cliente aprueba este texto aparte; la campaña aprobada no cambia. Sin enlaces: X cobra
        US$0.20 por un post con enlace.
      </p>

      {error ? (
        <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
          No se pudo cargar la versión para X. Recarga la página.
        </p>
      ) : (
        <>
          {variante && variante.vigente === false && (
            <p role="alert" className="mb-3 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
              El copy o la imagen de la campaña cambiaron desde que se preparó esta versión. Vuelve a resumirla y
              envíala al cliente.
            </p>
          )}
          {variante?.estado === 'rechazada' && variante.feedback_cliente && (
            <div className="mb-3 rounded-lg border border-outline-variant px-4 py-3">
              <p className="mb-1 text-xs font-semibold text-error">Comentario del cliente</p>
              <p className="text-sm text-on-surface">{variante.feedback_cliente}</p>
            </div>
          )}
          {estado?.ayuda && !bloqueada && <p className="mb-2 text-xs text-on-surface-variant">{estado.ayuda}</p>}
          {bloqueada && (
            <p className="mb-2 text-xs text-on-surface-variant">
              Ya se publicó (o está en revisión): este texto queda como registro de lo publicado.
            </p>
          )}

          <label htmlFor={`${id}-texto`} className="mb-1 block text-sm font-medium text-on-surface">
            Texto para X
          </label>
          <textarea
            id={`${id}-texto`}
            ref={textareaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={bloqueada}
            rows={5}
            placeholder="Escribe el post o pulsa «Resumir con IA»."
            aria-describedby={`${id}-contador${validacion.motivo && texto ? ` ${id}-aviso` : ''}`}
            aria-invalid={Boolean(texto) && !validacion.valido}
            className={`w-full resize-y rounded-lg border px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-transparent focus:ring-2 focus:ring-primary ${
              bloqueada
                ? 'cursor-not-allowed border-outline-variant bg-surface-container-low text-on-surface-variant'
                : 'border-outline-variant'
            }`}
          />
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
            <p
              id={`${id}-aviso`}
              role={validacion.url ? 'alert' : undefined}
              className="min-h-5 text-xs text-error"
            >
              {texto && validacion.motivo}
            </p>
            <p
              id={`${id}-contador`}
              aria-live="polite"
              className={`ml-auto text-xs tabular-nums ${
                validacion.longitud > MAXIMO_X ? 'font-semibold text-error' : 'text-on-surface-variant'
              }`}
            >
              <span aria-hidden="true">
                {validacion.longitud}/{MAXIMO_X}
              </span>
              <span className="sr-only">
                {validacion.longitud} de {MAXIMO_X} caracteres de X
              </span>
            </p>
          </div>

          {!bloqueada && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={resumir} disabled={ocupado !== null}>
                {ocupado === 'resumir' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {variante ? 'Volver a resumir con IA' : 'Resumir con IA'}
              </Button>
              {sinGuardar && (
                <Button size="sm" variant="outline" onClick={guardar} disabled={ocupado !== null || !validacion.valido}>
                  {ocupado === 'guardar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar texto
                </Button>
              )}
              {puedeEnviar && (
                <Button size="sm" onClick={enviar} disabled={ocupado !== null || !validacion.valido}>
                  {ocupado === 'enviar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar al cliente
                </Button>
              )}
            </div>
          )}

          {variante?.estado === 'aprobada' && !sinGuardar && (
            <div className="mt-5 border-t border-outline-variant pt-4">
            <fieldset className="space-y-3">
              <legend className="mb-3 text-sm font-semibold text-on-surface">Publicar en X</legend>
              {cuentas.length === 0 ? (
                <p className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
                  Ni el cliente ni tú tienen una cuenta de X conectada. Se conecta en Configuración → Redes
                  conectadas.
                </p>
              ) : (
                <div role="radiogroup" aria-label="Cuenta de X" className="space-y-2">
                  {cuentas.map((c) => {
                    const yaPublicada = publicadas.has(c.cuenta_nombre)
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 rounded-lg border border-outline-variant px-3 py-2 text-sm ${
                          yaPublicada ? 'opacity-60' : 'cursor-pointer hover:bg-surface-container-low'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${id}-cuenta`}
                          className="h-4 w-4 accent-primary"
                          checked={cuentaId === c.id}
                          disabled={yaPublicada}
                          onChange={() => setCuentaId(c.id)}
                        />
                        <RedIcon red="x" className="h-4 w-4" />
                        <span className="flex-1 font-medium text-on-surface">{c.cuenta_nombre}</span>
                        <span className="text-xs text-on-surface-variant">
                          {yaPublicada ? 'ya publicada' : c.propietario_rol === 'cliente' ? 'del cliente' : 'de la agencia'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {incierta && (
                <div role="alert" className="rounded-lg border border-warning/30 bg-warning-container px-3 py-2 text-xs text-tertiary">
                  <p className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    El último intento en {incierta.cuenta_nombre} quedó sin confirmar: el post pudo haberse publicado.
                  </p>
                  <label className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={revisado}
                      onChange={(e) => setRevisado(e.target.checked)}
                    />
                    Revisé la cuenta en X y el post no está publicado.
                  </label>
                </div>
              )}

              {config.restantes > 0 ? (
                <label className="flex items-start gap-2 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={confirmoCosto}
                    onChange={(e) => setConfirmoCosto(e.target.checked)}
                  />
                  {textoConfirmacionCosto(config)}
                </label>
              ) : (
                <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-xs text-on-error-container">
                  Se alcanzó el tope mensual de gasto en X (US${config.tope_mensual_usd}). Podrás publicar el próximo
                  mes.
                </p>
              )}

              <Button size="sm" onClick={publicar} disabled={!listoParaPublicar || ocupado !== null}>
                {ocupado === 'publicar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RedIcon red="x" />}
                {ocupado === 'publicar' ? 'Publicando…' : 'Publicar en X'}
              </Button>
            </fieldset>
            </div>
          )}

          {publicaciones.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Publicaciones en X">
              {publicaciones.map((p) => (
                <li key={p.id} className="rounded-lg border border-outline-variant px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <RedIcon red="x" className="h-4 w-4" />
                    <span className="text-sm font-semibold text-on-surface">{p.cuenta_nombre}</span>
                    <span className="ml-auto text-xs font-semibold text-on-surface-variant">
                      {estadoPublicacion(p.estado).texto}
                    </span>
                  </div>
                  {p.error && <p className="mt-2 text-xs text-error">{p.error}</p>}
                  {p.permalink && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver en X
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
