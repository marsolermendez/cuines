import { useQueryClient } from '@tanstack/react-query'
import { CalendarClock, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProgressiveImage from '../../components/ProgressiveImage'
import { btnPrimary, btnSecondary, inputCls } from '../../components/ui'
import { formatDay, today } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useMe } from '../auth/profiles'
import { useSignedUrls } from './photos'
import { useDrafts } from './queries'
import { deleteEntry } from './save'

type Draft = NonNullable<ReturnType<typeof useDrafts>['data']>[number]
type Sort = 'manual' | 'planned' | 'recent' | 'az'

const SORTS: [Sort, string][] = [
  ['manual', 'Mi orden'],
  ['planned', 'Fecha prevista'],
  ['recent', 'Más recientes'],
  ['az', 'A–Z'],
]

const FAR = Number.MAX_SAFE_INTEGER
const sorters: Record<Sort, (a: Draft, b: Draft) => number> = {
  manual: (a, b) => (a.position ?? FAR) - (b.position ?? FAR),
  // Sin fecha prevista al final; a igual fecha, la más reciente primero.
  planned: (a, b) => (a.planned_for ?? '9999').localeCompare(b.planned_for ?? '9999') || b.created_at.localeCompare(a.created_at),
  recent: (a, b) => b.created_at.localeCompare(a.created_at),
  az: (a, b) => (a.recipes?.title ?? '').localeCompare(b.recipes?.title ?? '', 'es'),
}

// Búsqueda sin distinguir mayúsculas ni tildes.
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function Planned({ day }: { day: string }) {
  const sameMonth = day.slice(0, 7) === today().slice(0, 7)
  const label = formatDay(day, sameMonth ? { weekday: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase()
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${day < today() ? 'bg-clay/10 text-clay' : 'bg-line text-ink-soft'}`}>
      <CalendarClock className="size-3" aria-hidden="true" />
      Para el {label}
    </span>
  )
}

export default function DraftsPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useDrafts(me.id)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('manual')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drafts = data ?? []
  const urls = useSignedUrls(drafts.flatMap((d) => d.entry_photos.map((p) => p.thumb_path)))

  if (isPending) return <p className="text-ink-soft">Cargando…</p>
  if (isError) return <p>No se pudieron cargar tus recetas guardadas.</p>

  const tags = [...new Set(drafts.flatMap((d) => d.tags))].sort((a, b) => a.localeCompare(b, 'es'))
  const query = norm(q.trim())
  const list = [...drafts]
    .sort(sorters[sort])
    .filter((d) => (!tag || d.tags.includes(tag)) && (!query || norm([d.recipes?.title ?? '', d.body, ...d.tags].join(' ')).includes(query)))
  // Reordenar a mano solo tiene sentido viendo la lista entera.
  const canReorder = sort === 'manual' && !query && !tag

  async function act(task: () => Promise<void>, failure: string) {
    setBusy(true)
    setError(null)
    try {
      await task()
      await queryClient.invalidateQueries({ queryKey: ['diary'] })
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  const move = (i: number, dir: -1 | 1) =>
    act(async () => {
      const a = list[i]
      const b = list[i + dir]
      if (!a || !b) return
      // Intercambia el sitio con la vecina.
      const results = await Promise.all([
        supabase.from('entries').update({ position: b.position ?? Date.now() }).eq('id', a.id),
        supabase.from('entries').update({ position: a.position ?? Date.now() }).eq('id', b.id),
      ])
      if (results.some((r) => r.error)) throw new Error('reorder')
    }, 'No se pudo cambiar el orden.')

  const remove = (d: Draft) => {
    if (!window.confirm(`¿Quitar «${d.recipes?.title ?? 'esta receta'}» de Quiero cocinar?`)) return
    void act(() => deleteEntry(d.id, d.recipes?.id ?? null), 'No se pudo borrar. Inténtalo de nuevo.')
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-medium">Quiero cocinar</h2>
        <Link to="/draft/new" className={btnPrimary}>
          <Plus className="size-4" aria-hidden="true" />
          Añadir
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Solo tú ves esta lista.</p>

      {drafts.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-serif text-xl">Aún no has guardado nada</p>
          <p className="mt-1 text-ink-soft">Guarda aquí las recetas que quieres probar y cocínalas cuando te apetezca.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <input
              type="search"
              className={`${inputCls} min-w-0 flex-1 basis-48`}
              placeholder="Buscar por receta, nota o etiqueta"
              aria-label="Buscar"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className={`${inputCls} w-auto!`} aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por etiqueta">
              {tags.map((t) => (
                <button
                  key={t}
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={`rounded-full border px-3 py-1 text-xs ${tag === t ? 'border-clay bg-clay text-white' : 'border-line bg-paper text-ink-soft hover:bg-cream'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-clay">
              {error}
            </p>
          )}

          {list.length === 0 ? (
            <p className="mt-6 text-ink-soft">Nada coincide con ese filtro.</p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {list.map((d, i) => {
                const cover = d.entry_photos[0]
                return (
                  <li key={d.id} className="rounded-xl border border-line bg-paper p-3">
                    <div className="flex gap-3">
                      {cover && (
                        <ProgressiveImage
                          ratio={1}
                          src={urls[cover.thumb_path]}
                          placeholder={cover.placeholder}
                          width={cover.width}
                          height={cover.height}
                          alt=""
                          className="size-20 shrink-0 rounded-lg"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link to={`/draft/${d.id}`} className="font-serif text-lg font-medium hover:underline">
                          {d.recipes?.title}
                        </Link>
                        {d.body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{d.body}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {d.planned_for && <Planned day={d.planned_for} />}
                          {d.tags.map((t) => (
                            <span key={t} className="rounded-full bg-cream px-2 py-0.5 text-xs text-ink-soft">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link to={`/new?from=${d.id}`} className={btnPrimary}>
                        Cocinar ahora
                      </Link>
                      <Link to={`/draft/${d.id}`} className={btnSecondary}>
                        Editar
                      </Link>
                      <button className={btnSecondary} disabled={busy} onClick={() => remove(d)}>
                        Quitar
                      </button>
                      {canReorder && (
                        <span className="ml-auto flex">
                          <button className="rounded-lg p-2 text-ink-soft hover:bg-line disabled:opacity-30" aria-label="Subir" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                            <ChevronUp className="size-4" />
                          </button>
                          <button className="rounded-lg p-2 text-ink-soft hover:bg-line disabled:opacity-30" aria-label="Bajar" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)}>
                            <ChevronDown className="size-4" />
                          </button>
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
