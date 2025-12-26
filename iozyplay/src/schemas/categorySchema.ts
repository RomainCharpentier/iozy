import { z } from 'zod'

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Le nom de la catégorie est obligatoire')
    .trim(),
  emoji: z
    .string()
    .min(1, 'L\'icône est obligatoire'),
})

export type CategoryFormData = z.infer<typeof categorySchema>


