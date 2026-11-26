import { useState } from 'react'
import { Link } from 'react-router-dom'
import { inputCls } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { norm } from '../../lib/text'
import { useRecipebook } from './queries'

type Sort = 'last' | 'times' | 'az'
const SORTS: [Sort, string][] = [
  ['last', 'Última vez'],
  ['times', 'Más cocinadas'],
  ['az', 'A–Z'],
]

/** Las recetas de un diario sin repetir: cuántas veces se han cocinado y la última. Sale de las mismas entradas. */
export default function Recipebook({ ownerId }: { ownerId: string }) {
  const { data, isPending, isError } = useRecipebook(ownerId)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('last')

  if (isPending) return <p className="text-ink-soft">Cargando…</p>
  if (isError) return <p>No se pudo cargar el recetario.</p>

  // `data` llega de la más reciente a la más antigua: la primera fila de cada receta es su última vez.
  const groups = new Map<string, { id: string; title: string; times: number; last: string }>()
  for (const row of data) {
    const g = groups.get(row.recipe_id)
    if (g) g.times += 1
    else groups.set(row.recipe_id, { id: row.recipes.id, title: row.recipes.title, times: 1, last: row.cooked_on })
  }
  const query = norm(q.trim())
  const list = [...groups.values()]
    .filter((g) => !query || norm(g.title).includes(query))
    .sort((a, b) =>
      sort === 'az' ? a.title.localeCompare(b.title, 'es') : sort === 'times' ? b.times - a.times || b.last.localeCompare(a.last) : b.last.localeCompare(a.last),
    )

  if (groups.size === 0) return <p className="text-ink-soft">Todavía no hay recetas que puedas ver en este diario.</p>

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input type="search" className={`${inputCls} min-w-0 flex-1 basis-48`} placeholder="Buscar una receta" aria-label="Buscar una receta" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputCls} w-auto!`} aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {list.length === 0 ? (
        <p className="mt-6 text-ink-soft">Ninguna receta coincide.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {list.map((g) => (
            <li key={g.id}>
              <Link to={`/r/${g.id}`} className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 hover:shadow-sm">
                <span className="min-w-0 truncate font-serif text-lg font-medium">{g.title}</span>
                <span className="shrink-0 text-sm text-ink-soft">
                  {g.times > 1 && <span className="mr-2 font-medium text-clay">×{g.times}</span>}
                  {formatDay(g.last, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
