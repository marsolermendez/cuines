import { Lock } from 'lucide-react'
import { useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { useProfileByUsername } from './profiles'

export default function ProfilePage() {
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
      <p className="mt-10 text-ink-soft">Aquí irá el diario (Fase 2).</p>
    </div>
  )
}
