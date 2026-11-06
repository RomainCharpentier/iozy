import { z } from 'zod'
import { parseTimecode } from '@/utils/timecode'

export const questionSchema = z.object({
  mediaUrl: z
    .string()
    .min(1, "L'URL YouTube est obligatoire")
    .refine(
      (url) => {
        try {
          const urlWithProtocol =
            url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
          new URL(urlWithProtocol)
          return true
        } catch {
          return false
        }
      },
      { message: "Format d'URL invalide" }
    )
    .refine((url) => url.includes('youtube.com') || url.includes('youtu.be'), {
      message: 'Seules les URLs YouTube sont supportées',
    }),
  answer: z.string().min(1, 'La réponse est obligatoire').trim(),
  hint: z.string().optional(),
  // Saisi en « mm:ss » ou en secondes, converti en secondes à l'enregistrement (parseTimecode)
  startTime: z
    .string()
    .optional()
    .refine((value) => value === undefined || parseTimecode(value) !== null, {
      message: 'Format invalide : utilisez mm:ss ou un nombre de secondes',
    }),
  categories: z.array(z.string()).min(1, 'Au moins une catégorie doit être sélectionnée'),
})

export type QuestionFormData = z.infer<typeof questionSchema>
