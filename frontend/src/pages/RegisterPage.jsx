import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { ArrowLeft, Check, Mic, Users } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel'
import AuthField from '@/components/auth/AuthField'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { useAuth } from '../hooks/useAuth'
import { useAuthBrandContent } from '../hooks/useAuthBrandContent'
import GoogleAccess from '@/components/auth/GoogleAccess'
import { setAuthItem, startSession } from '../services/session'
import { cn } from '@/lib/utils'

const ROLES = [
  { val: 'marketero', label: 'Marketero', desc: 'Creo campañas para mis clientes' },
  { val: 'cliente', label: 'Cliente', desc: 'Reviso y apruebo lo que se publica' },
]

/**
 * Registro: mismo marco que el login. POST /api/auth/register/ con
 * {email, nombre, password, rol}; solo marketero o cliente (nunca superadmin).
 * El rol se elige primero: vale para el formulario y para "Registrarse con Google",
 * que lo fija en el servidor antes de abrir la ventana de Google.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loading, setLoading] = useState(false)
  const brandContent = useAuthBrandContent('register')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues: { rol: 'marketero' } })

  // Estado local en vez de watch(): el React Compiler puede optimizar el componente.
  const [rolSel, setRolSel] = useState('marketero')

  async function entrarConGoogle(sesion) {
    startSession(sesion)
    if (sesion.email) setAuthItem('user_email', sesion.email)
    toast.success('Listo. Ya estás dentro de NexoMark IA.')
    navigate('/dashboard', { replace: true })
  }

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
      toast.success('Cuenta creada. Bienvenido a NexoMark IA.')
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

  return (
    <div className="flex min-h-screen bg-background">
      <AppToaster />
      <main className="flex min-h-screen flex-1 flex-col px-4 py-5 sm:px-8 lg:px-16">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem]">
            <Link to="/" aria-label="NexoMark IA, ir al inicio" className="inline-block text-2xl">
              <BrandLogo />
            </Link>
            <h1 className="mt-10 text-[2rem] font-bold leading-tight tracking-[-0.02em] text-on-surface">
              Crea tu cuenta
            </h1>
            <p className="mt-2 text-base text-on-surface-variant">
              Las cuentas de marketero empiezan con 100 créditos de IA: uno por campaña generada.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
              <fieldset>
                <legend className="text-sm font-medium text-on-surface">¿Cómo usarás NexoMark?</legend>
                <div role="radiogroup" aria-label="Tipo de cuenta" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ROLES.map((r) => {
                    const selected = rolSel === r.val
                    return (
                      <button
                        key={r.val}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setRolSel(r.val)
                          setValue('rol', r.val)
                        }}
                        className={cn(
                          'relative rounded-xl border p-4 text-left transition-[border-color,background-color] duration-150 active:scale-[0.99]',
                          selected
                            ? 'border-primary bg-primary-fixed'
                            : 'border-outline-variant bg-surface-container-lowest hover:border-outline',
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span className="text-[15px] font-semibold text-on-surface">{r.label}</span>
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border',
                              selected ? 'border-primary bg-primary text-on-primary' : 'border-outline',
                            )}
                            aria-hidden="true"
                          >
                            {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </span>
                        <span className="mt-1 block text-[13px] text-on-surface-variant">{r.desc}</span>
                      </button>
                    )
                  })}
                </div>
                <input type="hidden" {...register('rol', { required: true })} />
              </fieldset>

              <AuthField
                id="nombre"
                label="Nombre completo"
                autoComplete="name"
                error={errors.nombre?.message}
                {...register('nombre', { required: 'Escribe tu nombre' })}
              />

              <AuthField
                id="email"
                type="email"
                label="Correo electrónico"
                autoComplete="email"
                placeholder="nombre@empresa.com"
                error={errors.email?.message}
                {...register('email', {
                  required: 'Escribe tu correo',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ese correo no parece válido' },
                })}
              />

              <AuthField
                id="password"
                type="password"
                label="Contraseña"
                autoComplete="new-password"
                hint="Mínimo 8 caracteres."
                error={errors.password?.message}
                {...register('password', {
                  required: 'Escribe una contraseña',
                  minLength: { value: 8, message: 'Usa al menos 8 caracteres' },
                })}
              />



              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </Button>
            </form>

            <div className="mt-6">
              <GoogleAccess
                proposito="register"
                rol={rolSel}
                rolEtiqueta={ROLES.find((r) => r.val === rolSel)?.label}
                onSesion={entrarConGoogle}
              />
            </div>

            <p className="mt-8 text-[15px] text-on-surface-variant">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </main>

      <AuthBrandPanel
        highlights={[
          { icon: Mic, titulo: 'Dicta la campaña', desc: 'Habla en Chrome o Edge; a NexoMark solo llega el texto.' },
          { icon: Users, titulo: 'Colabora con tus clientes', desc: 'Aprueban desde la web o la app Android.' },
        ]}
        quote={brandContent.quote}
        personName={brandContent.person_name}
        personRole={brandContent.person_role}
      />
    </div>
  )
}
