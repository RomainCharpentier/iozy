import { Category } from '@/types/category'

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
  // Point de départ de l'extrait en secondes (entier ≥ 0). Absent : `t=` / `start=` de l'URL
  // YouTube s'il existe, sinon 0. Voir getQuestionStartTime (utils/timecode.ts).
  startTime?: number
  /**
   * Départ aléatoire de la partie en cours, dans [0, 1) : tiré par le serveur (en ligne)
   * ou au lancement (solo), converti en secondes avec la durée du média (pickPlayableStart)
   */
  startFraction?: number
  /** Durée du média en secondes, relevée par l'éditeur : départ calculable avant la lecture */
  duration?: number
}

export type QuestionsData = Record<Category, Question[]>
