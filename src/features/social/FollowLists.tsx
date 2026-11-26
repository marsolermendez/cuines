import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { useMyConnections } from './follows'

type Side = 'following' | 'followers'

const EMPTY: Record<Side, string> = {
  following: 'Todavía no sigues a nadie.',
  followers: 'Todavía no te sigue nadie.',
}

/** Mis seguidos y mis seguidores, con su número; al pulsar uno se despliega la lista. Solo en mi propio perfil. */
export default function FollowLists() {
  const { data } = useMyConnections()
  const [open, setOpen] = useState<Side | null>(null)
  if (!data) return null

  const tabs: { side: Side; one: string; many: string }[] = [
    { side: 'following', one: 'seguido', many: 'seguidos' },
    { side: 'followers', one: 'seguidor', many: 'seguidores' },
  ]
  const people = open ? data[open] : []

  return (
    <section className="mt-4" aria-label="Seguidos y seguidores">
      <div className="flex gap-5 text-sm">
        {tabs.map(({ side, one, many }) => (
          <button
            key={side}
            type="button"
            aria-expanded={open === side}
            className={`rounded py-1 hover:text-ink ${open === side ? 'text-ink' : 'text-ink-soft'}`}
            onClick={() => setOpen(open === side ? null : side)}
          >
            <span className="font-medium text-ink">{data[side].length}</span> {data[side].length === 1 ? one : many}
          </button>
        ))}
      </div>
      {open && (
        <ul className="mt-2 grid gap-1">
          {people.map((p) => (
            <li key={p.id}>
              <Link to={`/u/${p.username}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-line">
                <Avatar profile={p} className="size-9" />
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">{p.display_name}</span>
                  <span className="text-ink-soft">@{p.username}</span>
                </span>
              </Link>
            </li>
          ))}
          {people.length === 0 && <li className="px-2 py-2 text-sm text-ink-soft">{EMPTY[open]}</li>}
        </ul>
      )}
    </section>
  )
}
