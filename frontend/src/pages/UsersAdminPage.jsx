import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import AppToaster from '@/components/ui/AppToaster'
import { Users, AlertCircle, RotateCcw, Ban, CircleCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../services/api'
import { Button } from '@/components/ui/button'
import CreditRequestsAdminPanel from '@/components/CreditRequestsAdminPanel'

/**
 * Gestión de usuarios (SuperAdmin). Consume Django /api/admin/users/.
 * LÓGICA INTACTA: fetch paginado, detección de "tú" (/api/auth/me/), reset-quota,
 * suspender/activar con confirmación, protección de auto-modificación.
 * Reglas de seguridad: nombre/email por escapado JSX (sin HTML crudo).
 */
const PAGE_SIZE = 20

const ROL_BADGES = {
  superadmin: 'bg-primary-fixed text-on-primary-fixed',
  marketero: 'bg-secondary-container text-primary',
  cliente: 'bg-success-container text-success',
}
const ROL_LABELS = {
  superadmin: 'SuperAdmin',
  marketero: 'Marketero',
  cliente: 'Cliente',
}

function RolBadge({ rol }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${
        ROL_BADGES[rol] ?? 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {ROL_LABELS[rol] ?? rol}
    </span>
  )
}

function EstadoChip({ activo }) {
  return activo ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-container px-2.5 py-0.5 text-[13px] font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2.5 py-0.5 text-[13px] font-semibold text-error">
      <span className="h-1.5 w-1.5 rounded-full bg-error" />
      Suspendido
    </span>
  )
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [confirm, setConfirm] = useState(null) // { type, user }
  const [busy, setBusy] = useState(false)

  // loadUsers solo setea estado en callbacks async (apto para el efecto);
  // fetchUsers agrega el reset síncrono y se usa desde handlers.
  const loadUsers = (targetPage) => {
    api
      .get('/api/admin/users/', { params: { page: targetPage } })
      .then((res) => {
        setUsers(res.data.results ?? [])
        setCount(res.data.count ?? 0)
      })
      .catch(() => setError('No se pudo cargar la lista de usuarios. Verifica tu sesión.'))
      .finally(() => setLoading(false))
  }

  const fetchUsers = (targetPage = page) => {
    setLoading(true)
    setError(null)
    loadUsers(targetPage)
  }

  const goToPage = (updater) => {
    setLoading(true)
    setError(null)
    setPage(updater)
  }

  useEffect(() => {
    api
      .get('/api/auth/me/')
      .then((res) => setCurrentUserId(res.data?.data?.user?.id ?? null))
      .catch(() => setCurrentUserId(null))
  }, [])

  useEffect(() => {
    loadUsers(page)
  }, [page])

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const handleToggleActive = (user) =>
    setConfirm({ type: user.is_active ? 'suspend' : 'activate', user })
  const handleResetQuota = (user) => setConfirm({ type: 'reset', user })

  const performAction = async () => {
    if (!confirm) return
    setBusy(true)
    try {
      if (confirm.type === 'reset') {
        const { data } = await api.patch(`/api/admin/users/${confirm.user.id}/reset-quota/`)
        toast.success(data?.message ?? 'Cuota reseteada.')
      } else {
        const targetActive = confirm.type === 'activate'
        const { data } = await api.patch(`/api/admin/users/${confirm.user.id}/`, {
          is_active: targetActive,
        })
        toast.success(
          data?.message ?? (targetActive ? 'Usuario reactivado.' : 'Usuario suspendido.'),
        )
      }
      setConfirm(null)
      fetchUsers(page)
    } catch (err) {
      toast.error(err?.response?.data?.message ?? 'No se pudo completar la acción.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <AppToaster />

      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-on-surface sm:text-[38px]">Usuarios</h1>
          <p className="mt-2 text-base text-on-surface-variant">
            Gestiona cuentas, roles y la cuota de créditos de cada usuario.
          </p>
        </div>
        {count > 0 && (
          <span className="text-sm text-on-surface-variant">
            {count} {count === 1 ? 'usuario' : 'usuarios'} en total
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-outline-variant/40 px-4 py-4 last:border-0"
            >
              <div className="h-4 flex-1 animate-pulse rounded bg-surface-container-high" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-surface-container-high" />
            </div>
          ))}
        </div>
      ) : !error ? (
        <>
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="px-4 py-3 text-left text-[13px] font-semibold text-on-surface-variant">Nombre</th>
                    <th className="px-4 py-3 text-left text-[13px] font-semibold text-on-surface-variant">Email</th>
                    <th className="px-4 py-3 text-left text-[13px] font-semibold text-on-surface-variant">Rol</th>
                    <th className="px-4 py-3 text-left text-[13px] font-semibold text-on-surface-variant">Estado</th>
                    <th className="px-4 py-3 text-right text-[13px] font-semibold text-on-surface-variant">Créditos</th>
                    <th className="px-4 py-3 text-right text-[13px] font-semibold text-on-surface-variant">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                        <Users className="mx-auto mb-2 h-8 w-8 text-outline" />
                        No hay usuarios en esta página.
                      </td>
                    </tr>
                  )}
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        <td className="px-4 py-4 font-medium text-on-surface">
                          {u.nombre}
                          {isSelf && <span className="ml-2 text-[13px] text-on-surface-variant">(tú)</span>}
                        </td>
                        <td className="px-4 py-4 text-on-surface-variant">{u.email}</td>
                        <td className="px-4 py-4">
                          <RolBadge rol={u.rol} />
                        </td>
                        <td className="px-4 py-4">
                          <EstadoChip activo={u.is_active} />
                        </td>
                        <td className="px-4 py-4 text-right font-semibold tabular-nums text-on-surface">
                          {u.tokens_disponibles}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={isSelf}
                              title={isSelf ? 'No puedes modificar tu propia cuenta' : ''}
                              className={`inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                                isSelf
                                  ? 'cursor-not-allowed border-outline-variant/50 bg-surface-container-high text-outline'
                                  : u.is_active
                                    ? 'border-outline-variant text-on-surface-variant hover:border-error hover:bg-error-container hover:text-on-error-container'
                                    : 'border-success/40 text-success hover:bg-success-container'
                              }`}
                            >
                              {u.is_active ? <Ban className="h-3.5 w-3.5" /> : <CircleCheck className="h-3.5 w-3.5" />}
                              {u.is_active ? 'Suspender' : 'Activar'}
                            </button>
                            <button
                              onClick={() => handleResetQuota(u)}
                              disabled={isSelf}
                              title={isSelf ? 'No puedes modificar tu propia cuenta' : ''}
                              className={`inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                                isSelf
                                  ? 'cursor-not-allowed border-outline-variant/50 bg-surface-container-high text-outline'
                                  : 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10'
                              }`}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Resetear cuota
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goToPage((p) => Math.min(totalPages, p + 1))}>
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <CreditRequestsAdminPanel onResolved={() => fetchUsers(page)} />

      {confirm && (
        <ConfirmModal
          title={
            confirm.type === 'reset'
              ? 'Resetear cuota de créditos'
              : confirm.type === 'suspend'
                ? 'Suspender usuario'
                : 'Reactivar usuario'
          }
          message={
            confirm.type === 'reset'
              ? `Vas a resetear los créditos de ${confirm.user.nombre} a 100. ¿Confirmas?`
              : confirm.type === 'suspend'
                ? `${confirm.user.nombre} no podrá iniciar sesión ni usar la app. ¿Confirmas?`
                : `${confirm.user.nombre} podrá volver a usar la app. ¿Confirmas?`
          }
          confirmLabel={
            confirm.type === 'reset' ? 'Resetear' : confirm.type === 'suspend' ? 'Suspender' : 'Reactivar'
          }
          destructive={confirm.type === 'suspend'}
          onConfirm={performAction}
          onCancel={() => setConfirm(null)}
          busy={busy}
        />
      )}
    </div>
  )
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel, busy, destructive }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/60 p-4"
    >
      <div className="glass-liquid w-full max-w-md rounded-3xl p-8">
        <h3 id="confirm-title" className="mb-2 text-lg font-semibold text-on-surface">{title}</h3>
        <p className="mb-6 text-sm text-on-surface-variant">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy}
            className={destructive ? 'bg-error hover:bg-error/90' : ''}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
