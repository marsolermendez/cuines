import { useState } from 'react'
import { inputCls } from '../../components/ui'
import { useDebounced } from '../../lib/useDebounced'
import { useRecipeSearch } from './queries'

export type LinkedRecipe = { id: string; title: string }

/** Elegir una receta que ya existe entre las que puedo ver: la entrada la enlaza y cuenta como otra vez. */
export default function RecipePicker({ onPick }: { onPick: (recipe: LinkedRecipe) => void }) {
  const [text, setText] = useState('')
  const q = useDebounced(text)
  const { data, isFetching } = useRecipeSearch(q)

  return (
    <div>
      <input type="search" className={inputCls} aria-label="Buscar una receta" placeholder="Busca por nombre" value={text} onChange={(e) => setText(e.target.value)} />
      {q.trim().length >= 2 && (
        <ul className="mt-1 grid gap-1">
          {data?.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-line" onClick={() => onPick(r)}>
                <span className="font-medium">{r.title}</span>
                <span className="text-ink-soft">@{r.profiles?.username}</span>
              </button>
            </li>
          ))}
          {data?.length === 0 && !isFetching && <li className="px-3 py-2 text-sm text-ink-soft">No hay ninguna receta con ese nombre.</li>}
        </ul>
      )}
    </div>
  )
}
