import { Heart, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import ErrorState from '../../components/ErrorState'
import Loading from '../../components/Loading'
import { formatWhen } from '../../lib/dates'
import { useTitle } from '../../lib/useTitle'
import { isNew, useActivity, useActivitySeen } from './activity'

/** Actividad: quién ha dado me gusta o comentado en mis entradas. Lo posterior a mi última visita va marcado. */
export default function ActivityPage() {
  useTitle('Actividad')
  const { data: items, isPending, isError, refetch } = useActivity()
  const { seen, markSeen } = useActivitySeen()
  // La marca de esta visita se fija al entrar; markSeen mueve la de la próxima (y la insignia de la barra).
  const [since] = useState(seen)
  useEffect(() => {
    markSeen()
    return markSeen
  }, [])

  return (
    <div>
      <h2 className="font-serif text-2xl font-medium">Actividad</h2>
      <p className="mt-1 text-sm text-ink-soft">Me gusta y comentarios en tus entradas.</p>

      <div className="mt-6">
        {isPending && <Loading cards={1} />}
        {isError && <ErrorState message="No se pudo cargar la actividad." onRetry={() => refetch()} />}
        {items?.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-8 text-center">
            <p className="font-serif text-xl">Todavía no hay actividad</p>
            <p className="mt-1 text-ink-soft">Cuando alguien dé me gusta o comente una entrada tuya, lo verás aquí.</p>
          </div>
        )}
        <ul className="grid gap-2">
          {items?.map((i) => {
            const fresh = isNew(i.at, since)
            const Icon = i.kind === 'like' ? Heart : MessageCircle
            return (
              <li key={i.key}>
                <Link to={`/e/${i.entry.id}`} className={`flex gap-3 rounded-xl border bg-paper p-3 hover:bg-cream ${fresh ? 'border-clay' : 'border-line'}`}>
                  <Avatar profile={i.who} className="size-10" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p>
                      {fresh && <span className="sr-only">Nuevo: </span>}
                      <span className="font-medium">{i.who.display_name}</span> {i.kind === 'like' ? 'dio me gusta a' : 'comentó en'}{' '}
                      <span className="font-medium">{i.entry.title}</span>
                    </p>
                    {i.body && <p className="mt-0.5 line-clamp-2 break-words text-ink-soft">{i.body}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                      <Icon className="size-3.5" aria-hidden="true" />
                      {formatWhen(i.at)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
