import { useForm } from 'react-hook-form'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { ArrowLeft, Zap, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import AuthBrandPanel from '@/components/auth/AuthBrandPanel'
import AuthField from '@/components/auth/AuthField'
import BrandLogo from '@/components/BrandLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import GoogleAccess from '@/components/auth/GoogleAccess'
import { useAuthBrandContent } from '../hooks/useAuthBrandContent'
import { destinoTrasLogin, setAuthItem, startSession } from '../services/session'

/**
 * Inicio de sesión: formulario a la izquierda, panel marino de marca a la derecha.
 * useAuth().login → JWT → /dashboard. "Mantener sesión iniciada" decide si la
 * sesión vive en este navegador o solo en esta pestaña (también al entrar con Google).
 * "Continuar con Google" solo aparece si el servidor tiene client ID.
 */
export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = destinoTrasLogin(location.state?.desde)
  const brandContent = useAuthBrandContent('login')

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ mode: 'onTouched' })

  // Google responde con los mismos JWT que /api/auth/token/.
  async function entrarConGoogle(sesion) {
    startSession(sesion, { remember: Boolean(getValues('remember')) })
    if (sesion.email) setAuthItem('user_email', sesion.email)
    navigate(destino, { replace: true })
  }

  async function onSubmit({ email, password, remember }) {
    const result = await login(email, password, { remember: Boolean(remember) })

    if (!result.ok) {
      const msg =
        result.status === 401
          ? 'Correo o contraseña incorrectos'
          : result.status === 429
            ? result.message || 'Demasiados intentos. Espera unos minutos.'
            : 'El servidor no respondió. Intenta de nuevo en unos segundos.'
      toast.error(msg)
      return
    }

    navigate(destino, { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppToaster />
      <main className="flex min-h-screen flex-1 flex-col px-4 py-5 sm:px-8 lg:px-16 alto-corto:py-3">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>
          <ThemeToggle />
        </div>

        {/* En ventanas bajas (laptops) el formulario se compacta para caber sin scroll. */}
        <div className="flex flex-1 items-center justify-center py-10 alto-corto:py-3">
          <div className="w-full max-w-[26rem]">
            <Link to="/" aria-label="NexoMark IA, ir al inicio" className="inline-block text-2xl">
              <BrandLogo />
            </Link>
            <h1 className="mt-10 text-[2.375rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface alto-corto:mt-5 alto-corto:text-[2rem]">
              Inicia sesión
            </h1>
            <p className="mt-2 text-base text-on-surface-variant alto-minimo:hidden">
              Entra a tu panel para dictar campañas, revisarlas o ver cómo rinden.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5 alto-corto:mt-5 alto-corto:space-y-3.5">
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
                autoComplete="current-password"
                error={errors.password?.message}
                aside={
                  <Link to="/forgot-password" className="-my-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                }
                {...register('password', {
                  required: 'Escribe tu contraseña',
                  minLength: { value: 8, message: 'Tiene al menos 8 caracteres' },
                })}
              />

              <label htmlFor="remember" className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-1">
                <input
                  id="remember"
                  type="checkbox"
                  aria-describedby="remember-hint"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-outline"
                  {...register('remember')}
                />
                <span>
                  <span className="block text-sm font-medium text-on-surface">Mantener sesión iniciada</span>
                  <span id="remember-hint" className="block text-[13px] text-on-surface-variant">
                    Sin marcar, la sesión se cierra al cerrar esta pestaña.
                  </span>
                </span>
              </label>

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                {loading ? 'Ingresando…' : 'Iniciar sesión'}
              </Button>
            </form>

            <div className="mt-6 alto-corto:mt-4">
              <GoogleAccess proposito="login" onSesion={entrarConGoogle} />
            </div>

            <p className="mt-8 text-[15px] text-on-surface-variant alto-corto:mt-4">
              ¿No tienes una cuenta?{' '}
              <Link to="/register" className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary hover:underline">
                Regístrate
              </Link>
            </p>
          </div>
        </div>
      </main>

      <AuthBrandPanel
        highlights={[
          {
            icon: Zap,
            titulo: 'Generación 10× más rápida',
            desc: 'Crea activos publicitarios en segundos, no horas.',
            demo: true,
          },
          {
            icon: ShieldCheck,
            titulo: 'Lo aprobado es lo publicado',
            desc: 'Tu cliente aprueba la versión exacta que saldrá en sus redes.',
          },
        ]}
        quote={brandContent.quote}
        personName={brandContent.person_name}
        personRole={brandContent.person_role}
      />
    </div>
  )
}
