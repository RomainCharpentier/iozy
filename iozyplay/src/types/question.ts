import { Category } from './category'

export type MediaType = 'audio' | 'image' | 'video';

export interface Question {
  id: string;
  category: Category;
  type: MediaType;
  mediaUrl: string; // URL du média (audio, image ou vidéo)
  answer: string; // La réponse à deviner
  options?: string[]; // Options de réponse (optionnel, non utilisé en mode texte)
  hint?: string; // Indice optionnel
  timeLimit?: number; // Temps imparti en secondes (par défaut: 5)
}

export type QuestionsData = Record<Category, Question[]>;

// Ré-exporter pour compatibilité
export type { QuestionsData as QuestionsData };

