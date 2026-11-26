import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { inputCls } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useMe } from '../auth/profiles'

/** Buscar personas por nombre o @usuario para abrir su diario y seguirlas. */
export default function PeopleSearch() {
  const me = useMe()
  const [text, setText] = useState('')
  const [q, setQ] = useState('')

  // Espera a que se deje de escribir para no lanzar una consulta por tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim().replace(/^@/, '').replace(/[%,()*\\]/g, ' ').trim()), 300)
    return () => clearTimeout(t)
  }, [text])

  const { data: people, isFetching } = useQuery({
    queryKey: ['people', q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_private')
        .not('username', 'is', null)
        .neq('id', me.id)
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8)
      if (error) throw error
      return data
    },
  })

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
