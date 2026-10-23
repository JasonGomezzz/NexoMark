import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, Loader2, RefreshCw, Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import RedIcon from './RedIcon'
import PublicationBadge from './PublicationBadge'
import {
  MAX_TEXTO_TIKTOK,
  cuentasTikTokEnviadas,
  largoTextoTikTok,
  puedeConsultarTikTok,
  textoTikTokValido,
} from '../../services/social'
import { socialApi } from '../../services/socialApi'

const mensajeDe = (err, porDefecto) => err.response?.data?.message || porDefecto
const ESTADO_POR_DEFECTO = 'Estado del envío a TikTok.'

/**
 * "Enviar a TikTok" en una campaña aprobada (solo el marketero dueño).
 * TikTok no publica solo: la imagen y el texto aprobados llegan al buzón de la
 * cuenta y su dueño termina de publicar en la app de TikTok. Se envía una vez por
 * cuenta; después solo se consulta el estado. Sin TikTok configurado no se muestra.
 */
export default function TikTokPanel({ campaign }) {
  const id = useId()
  const [config, setConfig] = useState(null)
  const [cuentas, setCuentas] = useState(null)
  const [envios, setEnvios] = useState([])
  const [error, setError] = useState(false)
  const [elegida, setElegida] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [consultando, setConsultando] = useState(null)

  useEffect(() => {
    let vigente = true
    async function cargar() {
      try {
        const [c, publicaciones] = await Promise.all([
          socialApi.tiktokConfig(),
          socialApi.publicaciones(campaign.id),
        ])
        if (!vigente) return
        setConfig(c)
        // Los envíos ya hechos se siguen viendo aunque después se quite TikTok del servidor.
        setEnvios(publicaciones.filter((p) => p.red === 'tiktok'))
        if (!c.configurado) return
        const lista = await socialApi.destinosTikTok(campaign.id)
        if (vigente) setCuentas(lista)
      } catch {
        if (vigente) setError(true)
      }
    }
    cargar()
    return () => {
      vigente = false
    }
  }, [campaign.id])

  const configurado = Boolean(config?.configurado)
  if (!error && (!config || (!configurado && envios.length === 0))) return null

  const maximo = config?.max_texto ?? MAX_TEXTO_TIKTOK
  const enviadas = cuentasTikTokEnviadas(envios)
  const cuenta = cuentas?.find((c) => c.id === elegida) ?? null
  const textoOk = textoTikTokValido(campaign.texto_generado, maximo)
  const bloqueo = !configurado || !config?.medios_verificados
    ? null // el aviso del dominio ya explica por qué no se puede
    : !campaign.imagen_b64
      ? 'La campaña no tiene imagen: TikTok necesita una foto para el borrador.'
      : !textoOk
        ? `El texto aprobado debe tener entre 1 y ${maximo.toLocaleString('es-PE')} caracteres para TikTok.`
        : null
  const puedeRevisar = Boolean(cuenta) && config?.medios_verificados && !bloqueo && !enviadas.has(cuenta?.cuenta_nombre)

  function guardarEnvio(publicacion) {
    setEnvios((actuales) => [publicacion, ...actuales.filter((p) => p.id !== publicacion.id)])
  }

  async function enviar() {
    if (!cuenta) return
    setEnviando(true)
    try {
      const { publicacion, mensaje } = await socialApi.enviarTikTok(campaign.id, cuenta.id)
      guardarEnvio(publicacion)
      setConfirmando(false)
      setElegida(null)
      if (publicacion.estado === 'fallido') toast.error(mensaje)
      else toast.success(mensaje)
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo enviar a TikTok.'))
    } finally {
      setEnviando(false)
    }
  }

  async function consultar(envio) {
    setConsultando(envio.id)
    try {
      const { publicacion, mensaje } = await socialApi.estadoTikTok(envio.id)
      guardarEnvio(publicacion)
      if (mensaje && mensaje !== ESTADO_POR_DEFECTO) toast(mensaje)
      else toast.success('Estado al día.')
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo consultar el estado en TikTok.'))
    } finally {
      setConsultando(null)
    }
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="mt-4 rounded-xl border border-outline-variant bg-white p-5 shadow-sm"
    >
      <div className="mb-1 flex items-center gap-2.5">
        <RedIcon red="tiktok" className="h-4 w-4 text-on-surface" />
        <h2 id={`${id}-titulo`} className="text-sm font-semibold text-on-surface">
          Enviar a TikTok
        </h2>
      </div>
      <p className="text-sm text-on-surface-variant">
        TikTok no publica solo: la imagen y el texto aprobados llegan al buzón de la cuenta y su dueño termina de
        publicar en la app de TikTok. Se envía una vez por cuenta.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
          No se pudo cargar el envío a TikTok. Recarga la página.
        </p>
      ) : (
        <>
          {!configurado && (
            <p className="mt-4 rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              TikTok no está configurado en este servidor: se muestran los envíos ya hechos, pero no se pueden hacer
              nuevos ni consultar su estado.
            </p>
          )}
          {configurado && !config.medios_verificados && (
            <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-tertiary-container px-4 py-3 text-sm text-on-surface">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden="true" />
              Falta verificar en el portal de TikTok el dominio desde donde descarga la imagen. Hasta entonces no se
              puede enviar.
            </p>
          )}
          {bloqueo && (
            <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-tertiary-container px-4 py-3 text-sm text-on-surface">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" aria-hidden="true" />
              {bloqueo}
            </p>
          )}

          {envios.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Envíos a TikTok">
              {envios.map((envio) => (
                <li key={envio.id} className="rounded-lg border border-outline-variant px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <RedIcon red="tiktok" className="h-4 w-4 text-on-surface" />
                    <span className="min-w-0 truncate text-sm font-semibold text-on-surface">{envio.cuenta_nombre}</span>
                    <span className="ml-auto">
                      <PublicationBadge estado={envio.estado} red="tiktok" />
                    </span>
                  </div>
                  {envio.estado === 'en_buzon' && (
                    <p className="mt-2 text-[13px] text-on-surface-variant">
                      Llegó al buzón. Falta que el dueño de la cuenta lo abra en la app de TikTok y lo publique.
                    </p>
                  )}
                  {envio.estado === 'publicando' && (
                    <p className="mt-2 text-[13px] text-on-surface-variant">
                      TikTok está procesando la imagen. Consulta el estado en unos segundos.
                    </p>
                  )}
                  {envio.error && <p className="mt-2 text-[13px] text-error">{envio.error}</p>}
                  {configurado && puedeConsultarTikTok(envio) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 -ml-3"
                      onClick={() => consultar(envio)}
                      disabled={consultando !== null}
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${consultando === envio.id ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      Consultar estado
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {configurado && (
          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-on-surface">Cuenta de TikTok</legend>
            {cuentas === null ? (
              <div className="h-14 animate-pulse rounded-lg bg-surface-container-high" aria-hidden="true" />
            ) : cuentas.length === 0 ? (
              <p className="rounded-lg bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                Ni tú ni el cliente conectaron una cuenta de TikTok. Se conecta en{' '}
                <Link to="/settings" className="font-semibold text-primary hover:underline">
                  Configuración → Redes conectadas
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-2">
                {cuentas.map((c) => {
                  const yaEnviada = enviadas.has(c.cuenta_nombre)
                  const marcada = elegida === c.id
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors duration-150 ${
                        yaEnviada
                          ? 'cursor-not-allowed border-outline-variant opacity-60'
                          : marcada
                            ? 'cursor-pointer border-primary bg-primary-fixed'
                            : 'cursor-pointer border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${id}-cuenta`}
                        className="h-4 w-4 accent-primary"
                        checked={marcada}
                        disabled={yaEnviada}
                        onChange={() => setElegida(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-on-surface">{c.cuenta_nombre}</span>
                        <span className="block text-[13px] text-on-surface-variant">
                          {c.propietario_rol === 'cliente' ? 'Cuenta del cliente' : 'Tu cuenta'}
                        </span>
                      </span>
                      {yaEnviada && (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-on-surface-variant">
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          Ya enviada
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>
          )}

          {configurado && cuentas?.length > 0 && (
            <Button className="mt-4" size="sm" onClick={() => setConfirmando(true)} disabled={!puedeRevisar}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Revisar y enviar
            </Button>
          )}
        </>
      )}

      {confirmando && cuenta && (
        <ConfirmarEnvio
          campaign={campaign}
          cuenta={cuenta}
          maximo={maximo}
          enviando={enviando}
          onEnviar={enviar}
          onCerrar={() => !enviando && setConfirmando(false)}
        />
      )}
    </section>
  )
}

/** Confirmación: lo que se envía es exactamente esta imagen y este texto, rotulados como generados con IA. */
function ConfirmarEnvio({ campaign, cuenta, maximo, enviando, onEnviar, onCerrar }) {
  const id = useId()
  const [revisado, setRevisado] = useState(false)
  const caja = useRef(null)
  const cerrar = useRef(onCerrar)
  const texto = (campaign.texto_generado ?? '').trim()
  const largo = largoTextoTikTok(texto)

  useEffect(() => {
    cerrar.current = onCerrar
  })

  // Al abrir: foco en la confirmación, Esc cierra, el fondo no se desplaza; al cerrar, el foco vuelve.
  useEffect(() => {
    const origen = document.activeElement
    // Sin desplazar: en el teléfono el diálogo debe abrir mostrando a qué cuenta se envía.
    caja.current?.querySelector('input[type="checkbox"]')?.focus({ preventScroll: true })
    const alTeclear = (e) => {
      if (e.key === 'Escape') cerrar.current()
    }
    window.addEventListener('keydown', alTeclear)
    const desplazamiento = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = desplazamiento
      if (origen instanceof HTMLElement) origen.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-on-surface/40 p-3 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <motion.div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="glass-liquid max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id={`${id}-titulo`} className="text-lg font-semibold text-on-surface">
              Enviar al buzón de TikTok
            </h3>
            <p className="mt-0.5 truncate text-sm text-on-surface-variant">
              {cuenta.cuenta_nombre} · {cuenta.propietario_rol === 'cliente' ? 'cuenta del cliente' : 'tu cuenta'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-1 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-sm text-on-surface">
          Se envía exactamente esta imagen y este texto, como los aprobó el cliente. No se recortan ni se reenvían.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <figure className="min-w-0">
            <img
              src={`data:image/png;base64,${campaign.imagen_b64}`}
              alt={`Imagen aprobada de ${campaign.titulo}`}
              className="aspect-square w-full max-w-48 rounded-xl border border-outline-variant object-cover sm:max-w-none"
            />
            <figcaption className="mt-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-2.5 py-1 text-[13px] font-semibold text-tertiary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Contenido generado con IA
              </span>
              <span className="mt-1.5 block text-[13px] text-on-surface-variant">TikTok lo muestra con ese rótulo.</span>
            </figcaption>
          </figure>

          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface">Texto</p>
            <div className="mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-low px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap text-on-surface">
              {texto}
            </div>
            <p className="mt-1.5 text-[13px] text-on-surface-variant tabular-nums">
              {largo.toLocaleString('es-PE')} de {maximo.toLocaleString('es-PE')} caracteres
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-primary-fixed px-4 py-3 text-sm text-on-primary-fixed">
          <p className="font-semibold">Después de enviar</p>
          <p className="mt-0.5">
            El dueño de la cuenta abre la app de TikTok, revisa el borrador en su buzón, agrega música si quiere y lo
            publica. NexoMark no publica en TikTok por su cuenta.
          </p>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-on-surface">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            checked={revisado}
            onChange={(e) => setRevisado(e.target.checked)}
          />
          Revisé la imagen y el texto que se enviarán.
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={onEnviar} disabled={!revisado || enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {enviando ? 'Enviando…' : 'Enviar al buzón de TikTok'}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
