import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { canAccess, type ModuleKey } from '../lib/roles'
import { Spinner } from './Spinner'

/** Exige sesión iniciada y, opcionalmente, acceso a un módulo según el rol. */
export function ProtectedRoute({ module }: { module?: ModuleKey }) {
  const { loading, session, profile, roles, profileError, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner label="Verificando sesión…" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (!profile) {
    return (
      <div className="mx-auto mt-24 max-w-md px-4 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <p className="mb-4 text-sm">{profileError ?? 'No se pudo cargar tu perfil.'}</p>
        <button className="btn-secondary" onClick={() => void signOut()}>Cerrar sesión</button>
      </div>
    )
  }

  if (module && !canAccess(module, roles)) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
        <h1 className="mb-1 text-lg font-semibold">No tenés acceso a esta sección</h1>
        <p className="text-sm text-slate-500">Si creés que es un error, consultá con el administrador de la institución.</p>
      </div>
    )
  }
  return <Outlet />
}
