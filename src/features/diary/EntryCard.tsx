import { MessageCircle, UtensilsCrossed, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import ProgressiveImage from '../../components/ProgressiveImage'
import { formatDay } from '../../lib/dates'
import type { Profile } from '../../lib/types'
import LikeButton from '../social/LikeButton'
import { visibilityInfo } from './visibility'

type Props = {
  entry: {
    id: string
    title: string | null
    body: string
    cooked_on: string | null
    visibility: string
    recipes?: { title: string } | null
    entry_photos: { thumb_path: string; placeholder: string; width: number; height: number }[]
  }
  urls: Record<string, string>
  /** En mi propio diario se enseña con quién se comparte cada entrada. */
  showVisibility?: boolean
  /** Nombre de quien la escribió, si la entrada es de otra persona y estoy etiquetada: «Con …». */
  sharedBy?: string
  /** En el feed se enseña quién la escribió. */
  author?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> | null
  /** Me gusta y comentarios (feed). */
  social?: { liked: boolean; likes: number; comments: number }
}

/**
 * Tarjeta de una entrada: foto de portada, título y el comienzo del relato (el texto importa tanto como la foto).
 * Toda la tarjeta es un enlace (el del título, estirado); lo interactivo de dentro va por encima (`relative z-10`).
 */
export default function EntryCard({ entry, urls, showVisibility, sharedBy, author, social }: Props) {
  const cover = entry.entry_photos[0]
  const vis = visibilityInfo(entry.visibility)
  return (
    <article className="relative overflow-hidden rounded-xl border border-line bg-paper transition hover:shadow-sm">
      {author && (
        <Link to={`/u/${author.username}`} className="relative z-10 flex items-center gap-2 p-3 text-sm font-medium hover:underline">
          <Avatar profile={author} className="size-7" />
          {author.display_name}
        </Link>
      )}
      {cover && (
        <ProgressiveImage
          crop
          src={urls[cover.thumb_path]}
          placeholder={cover.placeholder}
          width={cover.width}
          height={cover.height}
          alt=""
        />
      )}
      <div className="p-4">
        <p className="flex items-center gap-2 text-xs text-ink-soft">
          {entry.cooked_on && formatDay(entry.cooked_on)}
          {sharedBy && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" aria-hidden="true" />
              con {sharedBy}
            </span>
          )}
          {showVisibility && entry.visibility !== 'public' && (
            <span className="inline-flex items-center gap-1">
              <vis.icon className="size-3" aria-hidden="true" />
              {vis.label}
            </span>
          )}
        </p>
        <h3 className="mt-1 font-serif text-xl font-medium">
          <Link to={`/e/${entry.id}`} className="after:absolute after:inset-0">
            {entry.title}
          </Link>
        </h3>
        {entry.recipes && (
          <p className="mt-1 flex items-center gap-1 text-sm text-clay-soft">
            <UtensilsCrossed className="size-3.5" aria-hidden="true" />
            {entry.recipes.title}
          </p>
        )}
        {entry.body && <p className="mt-2 line-clamp-4 whitespace-pre-line leading-relaxed text-ink-soft">{entry.body}</p>}
      </div>
      {social && (
        <footer className="relative z-10 flex items-center gap-4 px-4 pb-3">
          <LikeButton entryId={entry.id} initialLiked={social.liked} initialCount={social.likes} />
          <Link to={`/e/${entry.id}#comentarios`} className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink" aria-label={`${social.comments} comentarios`}>
            <MessageCircle className="size-5" aria-hidden="true" />
            {social.comments}
          </Link>
        </footer>
      )}
    </article>
  )
}
