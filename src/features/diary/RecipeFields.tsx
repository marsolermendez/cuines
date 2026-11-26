import { Link } from 'react-router-dom'
import { btnSecondary, inputCls } from '../../components/ui'

export type RecipeValues = { title: string; ingredients: string; steps: string; sourceUrl: string }

export const recipeValues = (r?: { title: string; ingredients: string[]; steps: string[]; source_url: string | null } | null): RecipeValues => ({
  title: r?.title ?? '',
  ingredients: r?.ingredients.join('\n') ?? '',
  steps: r?.steps.join('\n') ?? '',
  sourceUrl: r?.source_url ?? '',
})

/** Los valores del formulario con los nombres que esperan los esquemas de zod. */
export const recipeInput = (r: RecipeValues) => ({
  recipe_title: r.title,
  ingredients: r.ingredients,
  steps: r.steps,
  source_url: r.sourceUrl,
})

type Props = { value: RecipeValues; onChange: (value: RecipeValues) => void; titlePlaceholder?: string; heading?: boolean }

export function RecipeFields({ value, onChange, titlePlaceholder, heading = true }: Props) {
  const set = (patch: Partial<RecipeValues>) => onChange({ ...value, ...patch })
  return (
    <section className="grid gap-4">
      {heading && <h3 className="font-serif text-lg font-medium">Receta</h3>}
      <label className="grid gap-1 text-sm">
        Nombre
        <input className={inputCls} value={value.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder={titlePlaceholder} />
      </label>
      <label className="grid gap-1 text-sm">
        Ingredientes <span className="text-ink-soft">(uno por línea)</span>
        <textarea className={inputCls} rows={5} value={value.ingredients} onChange={(e) => set({ ingredients: e.target.value })} />
      </label>
      <label className="grid gap-1 text-sm">
        Pasos <span className="text-ink-soft">(uno por línea)</span>
        <textarea className={inputCls} rows={5} value={value.steps} onChange={(e) => set({ steps: e.target.value })} />
      </label>
      <label className="grid gap-1 text-sm">
        Enlace a la receta original <span className="text-ink-soft">(opcional)</span>
        <input className={inputCls} type="url" value={value.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} placeholder="https://" />
      </label>
    </section>
  )
}

/** Una receta que no se edita aquí (enlazada o de otra persona): su nombre y un enlace a su página. */
export function RecipeSummary({ recipe, note, onChange }: { recipe: { id: string; title: string }; note?: string; onChange?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-4">
      <div className="min-w-0 flex-1">
        <Link to={`/r/${recipe.id}`} className="font-serif text-lg font-medium hover:underline">
          {recipe.title}
        </Link>
        {note && <p className="mt-0.5 text-sm text-ink-soft">{note}</p>}
      </div>
      {onChange && (
        <button type="button" className={btnSecondary} onClick={onChange}>
          Cambiar
        </button>
      )}
    </div>
  )
}
