import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import ErrorState from '../../components/ErrorState'
import Loading from '../../components/Loading'
import { useTitle } from '../../lib/useTitle'
import ProgressiveImage from '../../components/ProgressiveImage'
import { btnPrimary, btnSecondary } from '../../components/ui'
import { formatDay } from '../../lib/dates'
import { useMe } from '../auth/profiles'
import Comments from '../social/Comments'
import LikeButton from '../social/LikeButton'
import { useAnswerParticipation } from '../social/participation'
import RecipeBody from './RecipeBody'
import { useSignedUrls } from './photos'
import { useEntry, useRecipeStats } from './queries'
import { deleteEntry } from './save'
import { visibilityInfo } from './visibility'

export default function EntryPage() {
  const { id } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: entry, isPending, isError, refetch } = useEntry(id)
  useTitle(entry?.title)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const photos = entry?.entry_photos ?? []
  const urls = useSignedUrls(photos.flatMap((p) => [p.path, p.thumb_path]))
  const { data: stats } = useRecipeStats(entry?.recipes?.id)
  const answer = useAnswerParticipation()
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  if (isPending) return <Loading cards={1} />
  if (isError) return <ErrorState message="No se pudo cargar la entrada." onRetry={() => refetch()} />
  // La RLS no distingue "no existe" de "no puedes verla": para quien mira es lo mismo.
  if (!entry) return <p>Esta entrada no existe o no puedes verla.</p>
  // Un borrador no es una entrada que se lea: se gestiona en Quiero cocinar.
  if (entry.status === 'draft') return <Navigate to={`/draft/${entry.id}`} replace />

  const mine = entry.author_id === me.id
  const recipe = entry.recipes
  const author = entry.profiles
  const vis = visibilityInfo(entry.visibility)
  const [cover, ...rest] = photos
  // Personas etiquetadas: todas las ve su autora; quien lee la entrada solo ve a quienes aceptaron.
  const accepted = entry.entry_participants.filter((p) => p.status === 'accepted')
  const pendingTags = mine ? entry.entry_participants.filter((p) => p.status === 'pending') : []
  const myTag = entry.entry_participants.find((p) => p.user_id === me.id)

  async function remove() {
    if (!entry || !window.confirm('¿Borrar esta entrada y sus fotos? No se puede deshacer.')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteEntry(entry.id, recipe?.id ?? null)
      await queryClient.invalidateQueries({ queryKey: ['diary'] })
      navigate(`/u/${me.username}`, { replace: true })
    } catch {
      setError('No se pudo borrar. Inténtalo de nuevo.')
      setDeleting(false)
    }
  }

  return (
    <article>
      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      {myTag && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm">
          <p className="min-w-0 flex-1">
            {myTag.status === 'pending' ? `${author?.display_name} te ha etiquetado en esta entrada.` : 'Te etiquetaron en esta entrada y aparece en tu diario.'}
          </p>
          {myTag.status === 'pending' && (
            <button className={btnPrimary} disabled={answer.isPending} onClick={() => answer.mutate({ entryId: entry.id, accept: true })}>
              Aceptar
            </button>
          )}
          <button className={btnSecondary} disabled={answer.isPending} onClick={() => answer.mutate({ entryId: entry.id, accept: false })}>
            {myTag.status === 'pending' ? 'Rechazar' : 'Salir'}
          </button>
        </div>
      )}
      <p className="text-sm text-ink-soft">{entry.cooked_on && formatDay(entry.cooked_on, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h2 className="mt-1 font-serif text-3xl font-medium leading-tight">{entry.title}</h2>
      <div className="mt-3 flex items-center gap-3 text-sm text-ink-soft">
        {author && (
          <Link to={`/u/${author.username}`} className="flex items-center gap-2 hover:text-ink">
            <Avatar profile={author} className="size-7" />
            {author.display_name}
          </Link>
        )}
        {mine && (
          <span className="inline-flex items-center gap-1">
            <vis.icon className="size-3.5" aria-hidden="true" />
            {vis.label}
          </span>
        )}
      </div>

      {(accepted.length > 0 || pendingTags.length > 0) && (
        <p className="mt-2 text-sm text-ink-soft">
          Cocinado con{' '}
          {[...accepted, ...pendingTags].map((p, i) => (
            <span key={p.user_id}>
              {i > 0 && ', '}
              <Link to={`/u/${p.profiles?.username}`} className="text-ink hover:underline">
                @{p.profiles?.username}
              </Link>
              {p.status === 'pending' && ' (pendiente)'}
            </span>
          ))}
        </p>
      )}

      {cover && (
        <div className="mt-6 grid gap-2">
          <ProgressiveImage eager src={urls[cover.path]} placeholder={cover.placeholder} width={cover.width} height={cover.height} alt={entry.title ?? ''} className="rounded-xl" />
          {rest.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {rest.map((p) => (
                <a key={p.id} href={urls[p.path]} target="_blank" rel="noreferrer" aria-label="Ver la foto completa">
                  <ProgressiveImage src={urls[p.thumb_path]} placeholder={p.placeholder} width={p.width} height={p.height} alt="" ratio={4 / 3} className="rounded-lg" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {entry.body && <div className="mt-8 whitespace-pre-line text-[17px] leading-8">{entry.body}</div>}

      <div className="mt-6">
        <LikeButton entryId={entry.id} initialLiked={entry.likes.some((l) => l.user_id === me.id)} initialCount={entry.likes.length} />
      </div>

      {recipe && (
        <section className="mt-10 rounded-xl border border-line bg-paper p-5">
          <h3 className="font-serif text-xl font-medium">
            <Link to={`/r/${recipe.id}`} className="hover:underline">
              {recipe.title}
            </Link>
          </h3>
          {stats && stats.times > 0 && (
            <p className="mt-0.5 text-sm text-ink-soft">
              Hecha {stats.times} {stats.times === 1 ? 'vez' : 'veces'} · {stats.people} {stats.people === 1 ? 'persona' : 'personas'}
            </p>
          )}
          <RecipeBody recipe={recipe} />
        </section>
      )}

      <Comments entryId={entry.id} entryAuthorId={entry.author_id} />

      {mine && (
        <div className="mt-10 flex items-center gap-3">
          <Link to={`/e/${entry.id}/edit`} className={btnSecondary}>
            Editar
          </Link>
          <button className={btnSecondary} onClick={remove} disabled={deleting}>
            {deleting ? 'Borrando…' : 'Borrar'}
          </button>
          {error && <p role="alert" className="text-sm text-clay">{error}</p>}
        </div>
      )}
    </article>
  )
}
