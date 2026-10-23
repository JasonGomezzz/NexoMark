import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Loader2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AuthField from '@/components/auth/AuthField'
import { useTheme } from '../../hooks/useTheme'
import { googleApi, cargarGoogleIdentity } from '../../services/googleApi'
import {
  RENOVAR_DESAFIO_MS,
  anchoBotonGoogle,
  necesitaNuevoDesafio,
  resultadoGoogle,
  textoBotonGoogle,
} from '../../services/google'

/**
 * "Continuar con Google" con el botón oficial de Google Identity Services.
 *
 * 1. `google/challenge/` entrega un ticket, una prueba y el nonce (en registro,
 *    con el rol ya elegido).
 * 2. El botón de Google firma ese nonce dentro del ID token.
 * 3. `google/complete/` verifica el token en Django y responde con nuestros JWT.
 *
 * Si el correo ya tiene cuenta sin Google, el servidor pide la contraseña de
 * NexoMark una sola vez para vincularlo. El ticket, la prueba y el ID token
 * viven solo en memoria. Sin client ID en el servidor no se muestra nada.
 */
export default function GoogleAccess({ proposito = 'login', rol, rolEtiqueta, onSesion }) {
  const { theme } = useTheme()
  const id = useId()
  const contenedor = useRef(null)
  const medida = useRef(null)
  const intento = useRef(null)
  const ocupado = useRef(false)
  const alRecibir = useRef(null)

  const [config, setConfig] = useState(null)
  const [sdk, setSdk] = useState(null)
  const [ronda, setRonda] = useState(0)
  const [desafio, setDesafio] = useState(null)
  const [ancho, setAncho] = useState(320)
  const [fase, setFase] = useState('boton') // boton | verificando | vincular
  const [aviso, setAviso] = useState(null)
  const [password, setPassword] = useState('')

  const configurado = Boolean(config?.configured)
  const claveDesafio = `${proposito}:${rol ?? ''}:${ronda}`
  const vigente = desafio?.clave === claveDesafio ? desafio : null

  useEffect(() => {
    let activo = true
    googleApi
      .config()
      .then((c) => activo && setConfig(c))
      .catch(() => activo && setConfig({ configured: false }))
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!configurado) return undefined
    let activo = true
    cargarGoogleIdentity()
      .then((cliente) => activo && setSdk(cliente))
      .catch((error) => activo && setAviso({ tipo: 'error', mensaje: error.message, reintentar: true }))
    return () => {
      activo = false
    }
  }, [configurado, ronda])

  // Un desafío por intento: al cambiar el rol, al vencer (10 min en el servidor) o tras un error.
  useEffect(() => {
    if (!configurado) return undefined
    let activo = true
    googleApi
      .desafio(proposito, rol)
      .then((datos) => activo && setDesafio({ ...datos, clave: `${proposito}:${rol ?? ''}:${ronda}` }))
      .catch((error) =>
        activo &&
        setAviso({
          tipo: 'error',
          mensaje: error.response?.data?.message || 'No se pudo preparar el acceso con Google.',
          reintentar: true,
        }),
      )
    const renovar = window.setTimeout(() => setRonda((n) => n + 1), RENOVAR_DESAFIO_MS)
    return () => {
      activo = false
      window.clearTimeout(renovar)
    }
  }, [configurado, proposito, rol, ronda])

  // El botón se ajusta al ancho del formulario (Google acepta de 200 a 400 px).
  useEffect(() => {
    const nodo = medida.current
    if (!nodo || typeof ResizeObserver === 'undefined') return undefined
    const observador = new ResizeObserver(([entrada]) => setAncho(anchoBotonGoogle(entrada.contentRect.width)))
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [configurado])

  // Google se inicializa una vez por desafío (el nonce va firmado dentro del ID token)…
  useEffect(() => {
    if (!sdk || !vigente) return
    sdk.initialize({
      client_id: vigente.client_id,
      nonce: vigente.nonce,
      callback: (respuesta) => alRecibir.current?.(respuesta),
      ux_mode: 'popup',
      auto_select: false,
      context: proposito === 'register' ? 'signup' : 'signin',
    })
  }, [sdk, vigente, proposito])

  // …y el botón se vuelve a dibujar si cambia el tema o el ancho del formulario.
  useEffect(() => {
    const nodo = contenedor.current
    if (!sdk || !vigente || !nodo) return undefined
    sdk.renderButton(nodo, {
      type: 'standard',
      theme: theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: textoBotonGoogle(proposito),
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: 'es-419',
      width: ancho,
    })
    return () => nodo.replaceChildren()
  }, [sdk, vigente, theme, ancho, proposito])

  async function completar(clave) {
    const actual = intento.current
    if (!actual || ocupado.current) return
    ocupado.current = true
    setFase('verificando')
    setAviso(null)
    try {
      const sesion = await googleApi.completar(actual, clave)
      intento.current = null
      await onSesion(sesion)
    } catch (error) {
      const resultado = resultadoGoogle(error)
      setAviso(resultado)
      if (resultado.tipo === 'vincular') {
        setFase('vincular')
      } else {
        intento.current = null
        setFase('boton')
        if (necesitaNuevoDesafio(resultado.tipo)) setRonda((n) => n + 1)
      }
    } finally {
      ocupado.current = false
      setPassword('')
    }
  }

  useEffect(() => {
    alRecibir.current = (respuesta) => {
      if (!respuesta?.credential || !vigente) return
      intento.current = { ticket: vigente.ticket, proof: vigente.proof, credential: respuesta.credential }
      completar()
    }
  })

  function cancelarVinculo() {
    intento.current = null
    setPassword('')
    setAviso(null)
    setFase('boton')
  }

  if (!configurado) return null

  const vinculando = fase === 'vincular'
  const errorVisible = aviso && aviso.tipo !== 'vincular'

  return (
    <section aria-label={proposito === 'register' ? 'Registrarse con Google' : 'Entrar con Google'} className="space-y-4">
      <div className="flex items-center gap-3 text-[13px] text-on-surface-variant" aria-hidden="true">
        <span className="h-px flex-1 bg-outline-variant" />o<span className="h-px flex-1 bg-outline-variant" />
      </div>

      <div ref={medida} className={vinculando ? 'hidden' : 'relative'}>
        {/* Silueta del botón mientras Google lo dibuja (mismo tamaño: no salta el formulario). */}
        <div
          aria-hidden="true"
          style={{ width: ancho }}
          className="absolute inset-y-0 left-1/2 -translate-x-1/2 animate-pulse rounded-[4px] bg-surface-container-high"
        />
        <div
          ref={contenedor}
          aria-busy={fase === 'verificando'}
          className={`relative flex min-h-10 justify-center ${fase === 'verificando' ? 'pointer-events-none opacity-40' : ''}`}
        />
        {fase === 'verificando' && (
          <p role="status" className="mt-2 flex items-center justify-center gap-2 text-sm text-on-surface-variant">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Verificando con Google…
          </p>
        )}
      </div>

      {proposito === 'register' && rolEtiqueta && !vinculando && (
        <p className="text-center text-[13px] text-on-surface-variant">
          Con Google, tu cuenta se crea como <strong className="font-semibold text-on-surface">{rolEtiqueta}</strong>.
          Cámbialo arriba antes de continuar.
        </p>
      )}

      {vinculando && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (password) completar(password)
          }}
          className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-4"
        >
          <div>
            <p className="text-[15px] font-semibold text-on-surface">Vincula Google a tu cuenta</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {aviso?.contrasenaIncorrecta
                ? 'Ya existe una cuenta con ese correo. Confirma tu contraseña de NexoMark para vincular Google por primera vez.'
                : aviso?.mensaje}
            </p>
          </div>
          <AuthField
            id={`${id}-clave`}
            type="password"
            label="Contraseña de NexoMark"
            autoComplete="current-password"
            maxLength={128}
            autoFocus
            hint="No es la de Google: es la que usas para entrar aquí con tu correo."
            error={aviso?.contrasenaIncorrecta ? aviso.mensaje : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!password}>
              Vincular y entrar
            </Button>
            <Button type="button" variant="ghost" onClick={cancelarVinculo}>
              Cancelar
            </Button>
            <Link to="/forgot-password" className="ml-auto text-sm font-medium text-primary hover:underline">
              ¿No la recuerdas?
            </Link>
          </div>
        </form>
      )}

      {errorVisible && (
        <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-container px-3.5 py-3 text-sm text-on-error-container">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-1.5">
            <p>{aviso.mensaje}</p>
            {aviso.tipo === 'registro' && (
              <Link to="/register" className="inline-block font-semibold underline underline-offset-2">
                Crear cuenta con Google
              </Link>
            )}
            {aviso.reintentar && (
              <button
                type="button"
                onClick={() => {
                  setAviso(null)
                  setRonda((n) => n + 1)
                }}
                className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
