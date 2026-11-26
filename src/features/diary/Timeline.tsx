import { Link } from 'react-router-dom'
import { btnPrimary, btnSecondary } from '../../components/ui'
import { formatMonth } from '../../lib/dates'
import { useMe } from '../auth/profiles'
import EntryCard from './EntryCard'
import { useSignedUrls } from './photos'
import { useTimeline } from './queries'

export default function Timeline({ authorId }: { authorId: string }) {
  const isMe = useMe().id === authorId
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useTimeline(authorId)
  const entries = data?.pages.flat() ?? []
  const urls = useSignedUrls(entries.flatMap((e) => e.entry_photos.map((p) => p.thumb_path)))

  if (isPending) return <p className="text-ink-soft">Cargando…</p>
  if (isError) return <p>No se pudo cargar el diario. Inténtalo de nuevo.</p>

  if (entries.length === 0) {
    return isMe ? (
      <div className="rounded-xl border border-dashed border-line p-8 text-center">
        <p className="font-serif text-xl">Tu diario está vacío</p>
        <p className="mt-1 text-ink-soft">Cuenta lo último que has cocinado, con fotos y todo el relato.</p>
        <Link to="/new" className={`${btnPrimary} mt-4`}>
          Escribir la primera entrada
        </Link>
      </div>
    ) : (
      <p className="text-ink-soft">Todavía no hay entradas que puedas ver en este diario.</p>
    )
  }

  // Agrupadas por mes; ya llegan ordenadas de la más reciente a la más antigua.
  const months: { month: string; items: typeof entries }[] = []
  for (const e of entries) {
    const month = e.cooked_on.slice(0, 7)
    const last = months[months.length - 1]
    if (last?.month === month) last.items.push(e)
    else months.push({ month, items: [e] })
  }

  return (
    <div className="grid gap-8">
      {months.map(({ month, items }) => (
        <section key={month}>
          <h3 className="mb-3 font-serif text-lg font-medium text-ink-soft">{formatMonth(month)}</h3>
          <div className="grid gap-4">
            {items.map((e) => (
              <EntryCard key={e.id} entry={e} urls={urls} showVisibility={isMe && !e.shared} sharedBy={e.shared ? e.author_display_name : undefined} />
            ))}
          </div>
        </section>
      ))}
      {hasNextPage && (
        <button className={`${btnSecondary} justify-self-center`} onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Cargando…' : 'Ver entradas anteriores'}
        </button>
      )}
    </div>
  )
}
