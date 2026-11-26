import { z } from 'zod'

// Mismo patrón que el CHECK de profiles.username en la base de datos.
export const usernameSchema = z
  .string()
  .regex(/^[a-z0-9_]{3,20}$/, 'Entre 3 y 20 caracteres: minúsculas, números y _')

export const profileFormSchema = z.object({
  display_name: z.string().trim().min(1, 'Escribe tu nombre').max(60, 'Máximo 60 caracteres'),
  bio: z.string().trim().max(280, 'Máximo 280 caracteres'),
})
