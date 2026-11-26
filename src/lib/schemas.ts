import { z } from 'zod'

// Mismo patrón que el CHECK de profiles.username en la base de datos.
export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Entre 3 y 20 caracteres: minúsculas, números y _')

export const profileFormSchema = z.object({
  display_name: z.string().trim().min(1, 'Escribe tu nombre').max(60, 'Máximo 60 caracteres'),
  bio: z.string().trim().max(280, 'Máximo 280 caracteres'),
})

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

// Mismos límites que los CHECK de recipes y entries en la base de datos.
export const entryFormSchema = z.object({
  title: z.string().trim().min(1, 'Ponle un título a la entrada').max(120, 'Título: máximo 120 caracteres'),
  cooked_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige el día en que lo cocinaste'),
  body: z.string().max(20000, 'El relato admite hasta 20 000 caracteres'),
  visibility: z.enum(['public', 'followers', 'private']),
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
})
