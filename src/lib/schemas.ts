import { z } from 'zod'

// Mismo patrón que el CHECK de profiles.username en la base de datos.
export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Entre 3 y 20 caracteres: minúsculas, números y _')

export const profileFormSchema = z.object({
  display_name: z.string().trim().min(1, 'Escribe tu nombre').max(60, 'Máximo 60 caracteres'),
  bio: z.string().trim().max(280, 'Máximo 280 caracteres'),
})

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

// La receta (mismos límites que los CHECK de recipes en la base de datos). Es común a entradas y borradores.
const recipeShape = {
  recipe_title: z.string().trim().min(1, 'Ponle nombre a la receta').max(120, 'Receta: máximo 120 caracteres'),
  ingredients: z
    .string()
    .transform(lines)
    .pipe(
      z
        .array(z.string())
        .max(100, 'Máximo 100 ingredientes')
        .refine((a) => a.join('\n').length <= 10000, 'Demasiado texto en los ingredientes'),
    ),
  steps: z
    .string()
    .transform(lines)
    .pipe(
      z
        .array(z.string())
        .max(100, 'Máximo 100 pasos')
        .refine((a) => a.join('\n').length <= 20000, 'Demasiado texto en los pasos'),
    ),
  source_url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === '' || /^https?:\/\//.test(u), 'El enlace tiene que empezar por http:// o https://'),
}

type RecipeInput = { ingredients: string[]; steps: string[]; source_url: string }

// Una receta que se guarda para cocinar más tarde tiene que decir cómo se hace, por escrito o con un enlace.
const hasRecipeContent = (d: RecipeInput) => d.ingredients.length > 0 || d.steps.length > 0 || d.source_url !== ''
const recipeContentError = { message: 'Añade ingredientes y pasos, o un enlace a la receta', path: ['ingredients'] }

export const entryFormSchema = z.object({
  title: z.string().trim().min(1, 'Ponle un título a la entrada').max(120, 'Título: máximo 120 caracteres'),
  cooked_on: z.string().refine(isDay, 'Elige el día en que lo cocinaste'),
  body: z.string().max(20000, 'El relato admite hasta 20 000 caracteres'),
  visibility: z.enum(['public', 'followers', 'private']),
})

/** La receta sola, para cuando se escribe o edita una propia (no al enlazar una existente ni al ver una ajena). */
export const recipeFormSchema = z.object(recipeShape)

/** Solo la receta: «Guardar en Quiero cocinar» desde el formulario de entrada. */
export const recipeDraftSchema = recipeFormSchema.refine(hasRecipeContent, recipeContentError)

const parseTags = (s: string) => [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]

const draftShape = {
  body: z.string().max(20000, 'Las notas admiten hasta 20 000 caracteres'),
  tags: z
    .string()
    .transform(parseTags)
    .pipe(z.array(z.string().max(30, 'Cada etiqueta, máximo 30 caracteres')).max(10, 'Máximo 10 etiquetas')),
  planned_for: z.string().refine((v) => v === '' || isDay(v), 'Fecha prevista no válida'),
}

/** Notas, etiquetas y fecha prevista de un borrador (su receta se valida aparte si es editable). */
export const draftNotesSchema = z.object(draftShape)

// Mismos límites que los CHECK de comments y reports en la base de datos.
export const commentSchema = z.string().trim().min(1, 'Escribe algo').max(1000, 'Máximo 1000 caracteres')
export const reportReasonSchema = z.string().trim().min(1, 'Cuéntanos el motivo').max(300, 'Máximo 300 caracteres')
