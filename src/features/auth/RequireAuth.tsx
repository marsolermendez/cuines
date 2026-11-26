import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { btnSecondary } from '../../components/ui'
import { useSession } from './AuthProvider'
import { useMyProfile } from './profiles'

export function Splash() {
  return <p className="grid min-h-screen place-items-center text-ink-soft">Cargando…</p>
}

/** Rutas privadas: exige sesión y, tras el primer login, que se haya elegido el username. */
export default function RequireAuth() {
  const { session, loading } = useSession()
  const profile = useMyProfile()
  const { pathname } = useLocation()

  if (loading || (session && profile.isPending)) return <Splash />
  if (!session) return <Navigate to="/login" replace />

  if (profile.isError) {
    return (
      <div className="grid min-h-screen place-content-center gap-3 text-center">
        <p>No se pudo cargar tu perfil.</p>
        <div className="flex justify-center gap-2">
          <button className={btnSecondary} onClick={() => profile.refetch()}>
            Reintentar
          </button>
          <button className={btnSecondary} onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  const hasUsername = !!profile.data?.username
  if (!hasUsername && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (hasUsername && pathname === '/onboarding') return <Navigate to="/" replace />
  return <Outlet />
}
