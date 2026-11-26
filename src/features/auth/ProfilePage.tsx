import { Lock } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Calendar from '../diary/Calendar'
import Timeline from '../diary/Timeline'
import { useProfileByUsername } from './profiles'

const tab = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm ${isActive ? 'border-clay-soft text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`

/** Perfil = diario. El mismo diario se ve como línea temporal o como calendario mensual. */
export default function ProfilePage({ view }: { view: 'timeline' | 'calendar' }) {
  const { username } = useParams()
  const { data: profile, isPending, isError } = useProfileByUsername(username)

  if (isPending) return <p className="text-ink-soft">Cargando…</p>
  if (isError) return <p>No se pudo cargar este perfil.</p>
  if (!profile) return <p>No existe ningún diario con ese nombre.</p>

  return (
    <div>
      <header className="flex items-center gap-4">
        <Avatar profile={profile} className="size-20" />
        <div>
          <h2 className="font-serif text-2xl font-medium">{profile.display_name}</h2>
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            @{profile.username}
            {profile.is_private && <Lock className="size-3.5" aria-label="Diario privado" />}
          </p>
        </div>
      </header>
      {profile.bio && <p className="mt-4 whitespace-pre-line">{profile.bio}</p>}

      <nav className="mb-6 mt-8 flex border-b border-line" aria-label="Vistas del diario">
        <NavLink to={`/u/${profile.username}`} end className={tab}>
          Línea temporal
        </NavLink>
        <NavLink to={`/u/${profile.username}/calendario`} className={tab}>
          Calendario
        </NavLink>
      </nav>

      {view === 'timeline' ? <Timeline authorId={profile.id} /> : <Calendar authorId={profile.id} />}
    </div>
  )
}
