import type { Profile } from '../lib/types'

type Props = { profile: Pick<Profile, 'display_name' | 'username' | 'avatar_url'>; className?: string }

export default function Avatar({ profile, className = 'size-10' }: Props) {
  const initial = (profile.display_name || profile.username || '?').trim().charAt(0).toUpperCase()
  return profile.avatar_url ? (
    <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className={`${className} shrink-0 rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-line font-medium text-ink-soft`}
    >
      {initial}
    </span>
  )
}
