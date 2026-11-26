import { Link } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { btnPrimary, btnSecondary } from '../../components/ui'
import { useAnswerRequest, useFollowRequests } from './follows'

/** Solicitudes para seguir mi diario privado: se aceptan o se rechazan desde Ajustes. */
export default function FollowRequests() {
  const { data: requests = [] } = useFollowRequests()
  const answer = useAnswerRequest()
  if (requests.length === 0) return null

  return (
    <section className="mt-10 max-w-md" aria-labelledby="solicitudes">
      <h3 id="solicitudes" className="font-serif text-lg font-medium">
        Solicitudes para seguirte ({requests.length})
      </h3>
      <ul className="mt-3 grid gap-3">
        {requests.map((r) => (
          <li key={r.follower_id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
            {r.follower && <Avatar profile={r.follower} className="size-10" />}
            <Link to={`/u/${r.follower?.username}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
              <span className="font-medium">{r.follower?.display_name}</span>
              <span className="block text-ink-soft">@{r.follower?.username}</span>
            </Link>
            <button className={btnPrimary} disabled={answer.isPending} onClick={() => answer.mutate({ followerId: r.follower_id, accept: true })}>
              Aceptar
            </button>
            <button className={btnSecondary} disabled={answer.isPending} onClick={() => answer.mutate({ followerId: r.follower_id, accept: false })}>
              Rechazar
            </button>
          </li>
        ))}
      </ul>
      {answer.isError && (
        <p role="alert" className="mt-2 text-sm text-clay">
          No se pudo responder a la solicitud. Inténtalo de nuevo.
        </p>
      )}
    </section>
  )
}
