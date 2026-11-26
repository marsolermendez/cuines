import { Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { inputCls } from '../../components/ui'
import { usePeopleSearch } from './usePeopleSearch'

/** Buscar personas por nombre o @usuario para abrir su diario y seguirlas. */
export default function PeopleSearch() {
  const [text, setText] = useState('')
  const { q, people, isFetching } = usePeopleSearch(text)

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
        <input
          type="search"
          className={`${inputCls} pl-9`}
          placeholder="Buscar personas por nombre o @usuario"
          aria-label="Buscar personas"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {q.length >= 2 && (
        <ul className="mt-2 grid gap-1" aria-live="polite">
          {people?.map((p) => (
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
          {people?.length === 0 && !isFetching && <li className="px-2 py-2 text-sm text-ink-soft">No hay nadie con ese nombre.</li>}
        </ul>
      )}
    </div>
  )
}
