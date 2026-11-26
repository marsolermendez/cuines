import { btnPrimary, btnSecondary } from '../../components/ui'
import type { Profile } from '../../lib/types'
import { useFollowStatus, useToggleFollow } from './follows'

export default function FollowButton({ profile }: { profile: Pick<Profile, 'id' | 'display_name'> }) {
  const { data: status, isPending } = useFollowStatus(profile.id)
  const toggle = useToggleFollow(profile.id)
  if (isPending) return null

  const label = status === 'accepted' ? 'Siguiendo' : status === 'pending' ? 'Solicitud enviada' : 'Solicitar seguir'

  function click() {
    if (status === 'accepted' && !window.confirm(`¿Dejar de seguir a ${profile.display_name}? Para volver a seguirle tendrá que aceptarte otra vez.`)) return
    toggle.mutate(!!status)
  }

  return (
    <button
      className={status ? btnSecondary : btnPrimary}
      disabled={toggle.isPending}
      onClick={click}
      title={status === 'pending' ? 'Cancelar la solicitud' : status === 'accepted' ? 'Dejar de seguir' : undefined}
    >
      {label}
    </button>
  )
}
