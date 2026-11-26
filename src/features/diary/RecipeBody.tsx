import { ExternalLink } from 'lucide-react'

type Props = { recipe: { source_url: string | null; ingredients: string[]; steps: string[] } }

/** Enlace original, ingredientes y pasos de una receta. Lo comparten la entrada y la página de la receta. */
export default function RecipeBody({ recipe }: Props) {
  return (
    <>
      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-1 text-sm text-clay hover:underline">
          Receta original <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
      {recipe.ingredients.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-medium first:mt-0">Ingredientes</h4>
          <ul className="mt-1 list-disc pl-5 leading-7">
            {recipe.ingredients.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </>
      )}
      {recipe.steps.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-medium first:mt-0">Pasos</h4>
          <ol className="mt-1 list-decimal pl-5 leading-7">
            {recipe.steps.map((x, i) => (
              <li key={i} className="pl-1">
                {x}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
