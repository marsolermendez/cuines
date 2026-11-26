import { Link } from 'react-router-dom'
import { btnPrimary, btnSecondary } from '../../components/ui'
import { useAnswerParticipation, useParticipationRequests } from './participation'

/** Entradas en las que me han etiquetado: se leen, y se aceptan (pasan a mi diario) o se rechazan. */
export default function ParticipationRequests() {
  const { data: requests = [] } = useParticipationRequests()
  const answer = useAnswerParticipation()
  if (requests.length === 0) return null

  return (
    <section className="mt-10 max-w-md" aria-labelledby="etiquetas">
      <h3 id="etiquetas" className="font-serif text-lg font-medium">
        Te han etiquetado ({requests.length})
      </h3>
      <ul className="mt-3 grid gap-3">
        {requests.map((r) => (
          <li key={r.entry_id} className="rounded-xl border border-line bg-paper p-3">
            <Link to={`/e/${r.entry_id}`} className="text-sm hover:underline">
              <span className="font-medium">{r.entries?.title}</span>
              <span className="block text-ink-soft">
                cocinado con {r.entries?.profiles?.display_name} (@{r.entries?.profiles?.username})
              </span>
            </Link>
            <div className="mt-2 flex gap-2">
              <button className={btnPrimary} disabled={answer.isPending} onClick={() => answer.mutate({ entryId: r.entry_id, accept: true })}>
                Aceptar
              </button>
              <button className={btnSecondary} disabled={answer.isPending} onClick={() => answer.mutate({ entryId: r.entry_id, accept: false })}>
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {answer.isError && (
        <p role="alert" className="mt-2 text-sm text-clay">
          No se pudo responder. Inténtalo de nuevo.
        </p>
      )}
    </section>
  )
}
