import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Bookmark, CirclePlus, Home, Settings } from 'lucide-react'
import { useMe } from '../features/auth/profiles'
import { useFollowRequests } from '../features/social/follows'
import { useParticipationRequests } from '../features/social/participation'
import Loading from './Loading'
import Logo from './Logo'

export default function Layout() {
  const me = useMe()
  const requests = (useFollowRequests().data?.length ?? 0) + (useParticipationRequests().data?.length ?? 0)
  const { pathname } = useLocation()
  // HashRouter no reinicia el scroll al cambiar de pantalla.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const tabs = [
    { to: '/', label: 'Inicio', icon: Home, end: true },
    { to: '/draft', label: 'Quiero cocinar', icon: Bookmark },
    { to: '/new', label: 'Nueva', icon: CirclePlus },
    { to: `/u/${me.username}`, label: 'Mi diario', icon: BookOpen },
    { to: '/settings', label: 'Ajustes', icon: Settings, badge: requests },
  ]

  return (
    <div className="mx-auto min-h-screen max-w-4xl md:flex">
      {/* Con HashRouter un enlace #… cambiaría la ruta: el salto al contenido enfoca el <main> por código. */}
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:shadow"
        onClick={() => document.getElementById('contenido')?.focus()}
      >
        Saltar al contenido
      </button>
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-paper md:static md:w-52 md:shrink-0 md:flex-col md:gap-1 md:border-0 md:bg-transparent md:p-4">
        <p className="hidden px-3 py-4 text-2xl md:block">
          <Logo />
        </p>
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] leading-tight md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:py-2 md:text-sm ${
                isActive ? 'text-clay md:bg-paper' : 'text-ink-soft'
              }`
            }
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden="true" />
              {!!badge && (
                <span className="absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full bg-clay text-[10px] font-medium text-on-clay" aria-label={`${badge} solicitudes`}>
                  {badge}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
      <main id="contenido" tabIndex={-1} className="w-full max-w-[680px] px-4 pb-24 pt-6 outline-none md:pb-6">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
