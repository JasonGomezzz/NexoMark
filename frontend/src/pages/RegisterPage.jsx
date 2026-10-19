import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { ArrowLeft, Eye, EyeOff, Rocket, Users, Sparkles } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel'
import { useAuth } from '../hooks/useAuth'
import { useAuthBrandContent } from '../hooks/useAuthBrandContent'
import BrandLogo from '@/components/BrandLogo'
import GoogleSignIn from '@/components/auth/GoogleSignIn'
import { startAuthSession, setAuthItem } from '@/lib/authStorage'

/**
 * Registro rediseñado (sistema Lumina Creative). Mismo split que Login.
 * Consume el endpoint real POST /api/auth/register/ con {email, nombre, password, rol}.
 * Google es alternativa al registro local, con los mismos roles públicos: marketero y cliente.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const brandContent = useAuthBrandContent('register')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues: { rol: 'marketero' } })

  // Estado local en vez de watch(): mismo comportamiento y el React Compiler
  // puede optimizar el componente (watch usa mutabilidad interior).
  const [rolSel, setRolSel] = useState('marketero')
  const finishGoogle = useCallback(data => {
    startAuthSession(data, false)
    setAuthItem('user_email', data.email)
    navigate('/dashboard', { replace: true })
  }, [navigate])

  async function onSubmit({ nombre, email, password, rol }) {
    setLoading(true)
    try {
      await api.post('/api/auth/register/', { nombre, email, password, rol })
      const loginResult = await login(email, password)
      if (!loginResult.ok) {
        toast.success('Cuenta creada. Inicia sesión para continuar.')
        navigate('/login', { replace: true })
        return
      }
      toast.success('Cuenta creada. Bienvenido a NexoMark.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      // El backend envuelve los errores por campo en {success, message, data: {campo: [...]}}
      const fieldErrors = err.response?.data?.data
      const msg =
        fieldErrors?.email?.[0] ||
        fieldErrors?.password?.[0] ||
        fieldErrors?.nombre?.[0] ||
        fieldErrors?.rol?.[0] ||
        err.response?.data?.message ||
        'No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const roles = [
    { val: 'marketero', label: 'Marketero', desc: 'Creo campañas con IA' },
    { val: 'cliente', label: 'Cliente', desc: 'Reviso y apruebo campañas' },
  ]

  return (
    <main className="auth-shell flex min-h-screen flex-col overflow-hidden md:flex-row">
      <AppToaster />
      <Link
        to="/"
        className="glass-soft fixed left-5 top-5 z-30 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-on-surface shadow-sm transition hover:-translate-y-0.5 hover:bg-surface-container-low"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      {/* Izquierda: formulario */}
      <section className="auth-form-panel z-10 flex w-full items-center justify-center p-8 md:w-[54%] md:p-16 lg:p-20">
        <div className="glass-liquid w-full max-w-md rounded-[2rem] p-7 md:p-9">
          <div className="mb-10">
            <Link to="/" className="text-3xl">
              <BrandLogo />
            </Link>
            <p className="mt-2 text-base text-on-surface-variant">
              Impulsa tu marketing con inteligencia artificial de alto rendimiento.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-on-surface">Crea tu cuenta</h2>
              <p className="text-base text-on-surface-variant">
                Empieza a generar campañas con IA en minutos.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="nombre" className="px-1 text-sm font-medium text-on-surface-variant">
                  Nombre completo
                </label>
                <input
                  id="nombre"
                  type="text"
                  autoComplete="name"
                  placeholder="Tu nombre"
                  className={`w-full rounded-xl border px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary ${
                    errors.nombre ? 'border-error' : 'border-outline-variant'
                  }`}
                  {...register('nombre', { required: 'El nombre es requerido' })}
                />
                {errors.nombre && <p className="px-1 text-xs text-error">{errors.nombre.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="px-1 text-sm font-medium text-on-surface-variant">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@empresa.com"
                  className={`w-full rounded-xl border px-4 py-3 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary ${
                    errors.email ? 'border-error' : 'border-outline-variant'
                  }`}
                  {...register('email', {
                    required: 'El email es requerido',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Ingresa un email válido',
                    },
                  })}
                />
                {errors.email && <p className="px-1 text-xs text-error">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="px-1 text-sm font-medium text-on-surface-variant">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    className={`w-full rounded-xl border px-4 py-3 pr-12 text-base outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary ${
                      errors.password ? 'border-error' : 'border-outline-variant'
                    }`}
                    {...register('password', {
                      required: 'La contraseña es requerida',
                      minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="px-1 text-xs text-error">{errors.password.message}</p>
                )}
              </div>

              {/* Selector de rol */}
              <div className="space-y-2">
                <span className="px-1 text-sm font-medium text-on-surface-variant">
                  ¿Cómo usarás NexoMark?
                </span>
                <div role="group" aria-label="Rol de la cuenta" className="grid grid-cols-2 gap-3">
                  {roles.map((r) => (
                    <button
                      key={r.val}
                      aria-pressed={rolSel === r.val}
                      type="button"
                      onClick={() => {
                        setRolSel(r.val)
                        setValue('rol', r.val)
                      }}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        rolSel === r.val
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-on-surface">{r.label}</span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">{r.desc}</span>
                    </button>
                  ))}
                </div>
                <input type="hidden" {...register('rol', { required: true })} />
              </div>

              <Button type="submit" size="lg" disabled={loading} className="w-full text-lg">
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-xs text-on-surface-variant"><span className="h-px flex-1 bg-outline-variant" />o regístrate con<span className="h-px flex-1 bg-outline-variant" /></div>
            <p className="text-xs text-on-surface-variant">Para Google se usará el rol seleccionado arriba: {rolSel === 'marketero' ? 'Marketero' : 'Cliente'}. Si ya tienes cuenta, conservarás tu rol actual.</p>
            <GoogleSignIn key={rolSel} purpose="register" role={rolSel} onSuccess={finishGoogle} />
            <p className="text-center text-base text-on-surface-variant">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Derecha: panel de marca */}
      <AuthBrandPanel
        highlights={[
          { icon: Rocket, titulo: 'Tu primera campaña en minutos', desc: 'Del brief al anuncio, guiado por IA.' },
          { icon: Users, titulo: 'Colabora con tus clientes', desc: 'Aprobaciones desde web y móvil.' },
        ]}
        badgeIcon={Sparkles}
        quote={brandContent.quote}
        personName={brandContent.person_name}
        personRole={brandContent.person_role}
        personImage={brandContent.person_image}
      />
    </main>
  )
}
