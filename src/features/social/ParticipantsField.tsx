import { X } from 'lucide-react'
import { useState } from 'react'
import Avatar from '../../components/Avatar'
import { inputCls } from '../../components/ui'
import { usePeopleSearch, type Person } from './usePeopleSearch'

const MAX = 10

type Props = { value: Person[]; onChange: (value: Person[]) => void; pending?: ReadonlySet<string> }

/**
 * «Compartir autoría»: enseñar la entrada (y su receta) a quien cocinó contigo. Solo la autora la edita; la otra persona
 * tendrá que aceptar y entonces sale también en su diario y su recetario. Hasta entonces ya puede leerla.
 */
export default function ParticipantsField({ value, onChange, pending }: Props) {
  const [text, setText] = useState('')
  const { q, people } = usePeopleSearch(text)
  const candidates = people?.filter((p) => !value.some((v) => v.id === p.id)) ?? []

  return (
    <section>
      <h3 className="font-serif text-lg font-medium">
        Compartir autoría <span className="text-sm font-normal text-ink-soft">(opcional)</span>
      </h3>
      <p className="mb-3 mt-1 text-sm text-ink-soft">
        ¿Lo cocinaste con alguien? Compártela con esa persona: podrá leerla aunque no sea pública y, cuando la acepte, saldrá también en su diario y su recetario. Solo tú puedes editarla.
      </p>

      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {value.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full border border-line bg-paper py-1 pl-1 pr-2 text-sm">
              <Avatar profile={p} className="size-6" />
              @{p.username}
              {pending?.has(p.id) && <span className="text-xs text-ink-soft">(pendiente)</span>}
              <button type="button" aria-label={`Quitar a ${p.display_name}`} className="text-ink-soft hover:text-ink" onClick={() => onChange(value.filter((v) => v.id !== p.id))}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length < MAX && (
        <>
          <input type="search" className={inputCls} aria-label="Buscar personas con quien compartir la autoría" placeholder="Buscar por nombre o @usuario" value={text} onChange={(e) => setText(e.target.value)} />
          {q.length >= 2 && candidates.length > 0 && (
            <ul className="mt-1 grid gap-1">
              {candidates.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-line"
                    onClick={() => {
                      onChange([...value, p])
                      setText('')
                    }}
                  >
                    <Avatar profile={p} className="size-8" />
                    <span className="text-sm">
                      <span className="block font-medium">{p.display_name}</span>
                      <span className="text-ink-soft">@{p.username}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
