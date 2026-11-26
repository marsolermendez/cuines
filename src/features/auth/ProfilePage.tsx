import { Lock } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import Calendar from '../diary/Calendar'
import Recipebook from '../diary/Recipebook'
import Timeline from '../diary/Timeline'
import FollowButton from '../social/FollowButton'
import { useFollowStatus } from '../social/follows'
import { useMe, useProfileByUsername } from './profiles'

const tab = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-3 py-2 text-sm ${isActive ? 'border-clay-soft text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`

/** Perfil = diario. El mismo diario se ve como línea temporal o como calendario mensual. */
export default function ProfilePage({ view }: { view: 'timeline' | 'calendar' | 'recipes' }) {
  const { username } = useParams()
  const me = useMe()
  const { data: profile, isPending, isError } = useProfileByUsername(username)
  // Mi relación con esta persona; en mi propio perfil no hay nada que preguntar.
  const otherId = profile && profile.id !== me.id ? profile.id : undefined
  const { data: follow, isPending: followPending } = useFollowStatus(otherId)

  if (isPending) return <p className="text-ink-soft">Cargando…</p>
  if (isError) return <p>No se pudo cargar este perfil.</p>
  if (!profile) return <p>No existe ningún diario con ese nombre.</p>

  // Un diario privado solo se ve si te han aceptado. La base de datos ya no devolvería nada: esto solo lo explica.
  const locked = !!otherId && profile.is_private && follow !== 'accepted'

  return (
    <div>
      <header className="flex items-center gap-4">
        <Avatar profile={profile} className="size-20" />
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl font-medium">{profile.display_name}</h2>
          <p className="flex items-center gap-1 text-sm text-ink-soft">
            @{profile.username}
            {profile.is_private && <Lock className="size-3.5" aria-label="Diario privado" />}
          </p>
        </div>
        {otherId && <FollowButton profile={profile} />}
      </header>
      {profile.bio && <p className="mt-4 whitespace-pre-line">{profile.bio}</p>}

      {otherId && followPending ? (
        <p className="mt-8 text-ink-soft">Cargando…</p>
      ) : locked ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-8 text-center">
          <Lock className="mx-auto size-6 text-ink-soft" aria-hidden="true" />
          <p className="mt-2 font-serif text-xl">Este diario es privado</p>
          <p className="mt-1 text-ink-soft">
            {follow === 'pending'
              ? 'Tu solicitud está pendiente: cuando la acepte podrás ver sus entradas.'
              : `Solicita seguir a ${profile.display_name} para ver sus entradas.`}
          </p>
        </div>
      ) : (
        <>
          <nav className="mb-6 mt-8 flex border-b border-line" aria-label="Vistas del diario">
            <NavLink to={`/u/${profile.username}`} end className={tab}>
              Línea temporal
            </NavLink>
            <NavLink to={`/u/${profile.username}/calendario`} className={tab}>
              Calendario
            </NavLink>
            <NavLink to={`/u/${profile.username}/recetario`} className={tab}>
              Recetario
            </NavLink>
          </nav>
          {view === 'timeline' ? <Timeline authorId={profile.id} /> : view === 'calendar' ? <Calendar authorId={profile.id} /> : <Recipebook ownerId={profile.id} />}
        </>
      )}
    </div>
  )
}
