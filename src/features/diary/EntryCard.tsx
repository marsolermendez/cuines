import { UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProgressiveImage from '../../components/ProgressiveImage'
import { formatDay } from '../../lib/dates'
import { visibilityInfo } from './visibility'

type Props = {
  entry: {
    id: string
    title: string | null
    body: string
    cooked_on: string | null
    visibility: string
    recipes: { title: string } | null
    entry_photos: { thumb_path: string; placeholder: string; width: number; height: number }[]
  }
  urls: Record<string, string>
  /** En mi propio diario se enseña con quién se comparte cada entrada. */
  showVisibility?: boolean
}

/** Tarjeta de una entrada: foto de portada, título y el comienzo del relato (el texto importa tanto como la foto). */
export default function EntryCard({ entry, urls, showVisibility }: Props) {
  const cover = entry.entry_photos[0]
  const vis = visibilityInfo(entry.visibility)
  return (
    <Link to={`/e/${entry.id}`} className="block overflow-hidden rounded-xl border border-line bg-paper transition hover:shadow-sm">
      {cover && (
        <ProgressiveImage
          crop
          src={urls[cover.thumb_path]}
          placeholder={cover.placeholder}
          width={cover.width}
          height={cover.height}
          alt={entry.title ?? ''}
        />
      )}
      <div className="p-4">
        <p className="flex items-center gap-2 text-xs text-ink-soft">
          {entry.cooked_on && formatDay(entry.cooked_on)}
          {showVisibility && entry.visibility !== 'public' && (
            <span className="inline-flex items-center gap-1 normal-case">
              <vis.icon className="size-3" aria-hidden="true" />
              {vis.label}
            </span>
          )}
        </p>
        <h3 className="mt-1 font-serif text-xl font-medium">{entry.title}</h3>
        {entry.recipes && (
          <p className="mt-1 flex items-center gap-1 text-sm text-clay-soft">
            <UtensilsCrossed className="size-3.5" aria-hidden="true" />
            {entry.recipes.title}
          </p>
        )}
        {entry.body && <p className="mt-2 line-clamp-4 whitespace-pre-line leading-relaxed text-ink-soft">{entry.body}</p>}
      </div>
    </Link>
  )
}
