import { Category } from './category'

export type MediaType = 'audio' | 'image' | 'video'

export interface Question {
  id?: string // Optionnel : dérivé de mediaUrl si non fourni
  category: Category | Category[] // Support pour une ou plusieurs catégories
  type: MediaType
  mediaUrl: string // URL du média (clé primaire pour les questions YouTube)
  answer: string // La réponse à deviner
  options?: string[] // Options de réponse (optionnel, non utilisé en mode texte)
  hint?: string // Indice optionnel
  timeLimit?: number // Temps imparti en secondes (par défaut: 5)
}

export type QuestionsData = Record<Category, Question[]>
