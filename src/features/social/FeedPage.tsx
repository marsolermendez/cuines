import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import ErrorState from '../../components/ErrorState'
import Loading from '../../components/Loading'
import { btnSecondary } from '../../components/ui'
import { useTitle } from '../../lib/useTitle'
import EntryCard from '../diary/EntryCard'
import { useSignedUrls } from '../diary/photos'
import { useFeed } from '../diary/queries'
import { useMe } from '../auth/profiles'
import { isNew, useActivity, useActivitySeen } from './activity'
import PeopleSearch from './PeopleSearch'

/** Inicio: lo último de las personas a las que sigo. */
export default function FeedPage() {
  const me = useMe()
  const { seen } = useActivitySeen()
  const news = (useActivity().data ?? []).filter((i) => isNew(i.at, seen)).length
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeed()
  useTitle('Inicio')
  const entries = data?.pages.flat() ?? []
  const urls = useSignedUrls(entries.flatMap((e) => e.entry_photos.map((p) => p.thumb_path)))

  return (
    <div>
      <h2 className="font-serif text-2xl font-medium">Inicio</h2>
      <div className="mt-4 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <PeopleSearch />
        </div>
        <Link to="/actividad" aria-label="Actividad" className="relative flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-field bg-paper hover:bg-cream">
          <Bell className="size-5" aria-hidden="true" />
          {news > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-clay text-[10px] font-medium text-on-clay" aria-label={`${news} novedades`}>
              {news}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-6">
        {isPending && <Loading />}
        {isError && <ErrorState message="No se pudo cargar el inicio." onRetry={() => refetch()} />}
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
