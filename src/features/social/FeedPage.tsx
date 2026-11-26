import { btnSecondary } from '../../components/ui'
import EntryCard from '../diary/EntryCard'
import { useSignedUrls } from '../diary/photos'
import { useFeed } from '../diary/queries'
import { useMe } from '../auth/profiles'
import PeopleSearch from './PeopleSearch'

/** Inicio: lo último de las personas a las que sigo. */
export default function FeedPage() {
  const me = useMe()
  const { data, isPending, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeed()
  const entries = data?.pages.flat() ?? []
  const urls = useSignedUrls(entries.flatMap((e) => e.entry_photos.map((p) => p.thumb_path)))

  return (
    <div>
      <h2 className="font-serif text-2xl font-medium">Inicio</h2>
      <div className="mt-4">
        <PeopleSearch />
      </div>

      <div className="mt-6">
        {isPending && <p className="text-ink-soft">Cargando…</p>}
        {isError && <p>No se pudo cargar el inicio. Inténtalo de nuevo.</p>}
        {data && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-8 text-center">
            <p className="font-serif text-xl">Aquí verás lo que cocinan las personas a las que sigas</p>
            <p className="mt-1 text-ink-soft">Busca a alguien por su nombre y sigue su diario.</p>
          </div>
        )}
        <div className="grid gap-5">
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              urls={urls}
              author={e.profiles}
              social={{ liked: e.likes.some((l) => l.user_id === me.id), likes: e.likes.length, comments: e.comment_count[0]?.count ?? 0 }}
            />
          ))}
        </div>
        {hasNextPage && (
          <div className="mt-6 text-center">
            <button className={btnSecondary} onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
