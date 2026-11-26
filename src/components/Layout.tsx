import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Bookmark, CirclePlus, Home, Settings } from 'lucide-react'
import { useMe } from '../features/auth/profiles'

export default function Layout() {
  const me = useMe()
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
    { to: '/settings', label: 'Ajustes', icon: Settings },
  ]

  return (
    <div className="mx-auto min-h-screen max-w-4xl md:flex">
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-paper md:static md:w-52 md:shrink-0 md:flex-col md:gap-1 md:border-0 md:bg-transparent md:p-4">
        <p className="hidden px-3 py-4 font-serif text-2xl font-medium md:block">Cuines</p>
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] leading-tight md:flex-none md:flex-row md:gap-3 md:rounded-lg md:px-3 md:py-2 md:text-sm ${
                isActive ? 'text-clay-soft md:bg-paper' : 'text-ink-soft'
              }`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="w-full max-w-[680px] px-4 pb-24 pt-6 md:pb-6">
        <Outlet />
      </main>
    </div>
  )
}
