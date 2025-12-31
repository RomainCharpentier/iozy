export type Category = string; // Catégories dynamiques

export interface CategoryInfo {
  id: Category;
  name: string;
  emoji: string; // Stocke maintenant l'ID de l'icône (ex: "FaMusic") au lieu d'un emoji
}

// Catégories par défaut (seront remplacées par celles du serveur)
export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { id: 'chansons', name: 'Chansons', emoji: 'FaMusic' },
  { id: 'series', name: 'Séries TV', emoji: 'FaTv' },
  { id: 'animes', name: 'Animes', emoji: 'GiNinjaMask' },
  { id: 'films', name: 'Films', emoji: 'FaFilm' },
  { id: 'jeux', name: 'Jeux vidéo', emoji: 'FaGamepad' },
];

export type MediaType = 'audio' | 'image' | 'video';

export interface Question {
  id?: string; // Optionnel : dérivé de mediaUrl si non fourni
  category: Category | Category[]; // Support pour une ou plusieurs catégories
  type: MediaType;
  mediaUrl: string; // URL du média (clé primaire pour les questions YouTube)
  answer: string; // La réponse à deviner
  options?: string[]; // Options de réponse (optionnel, non utilisé en mode texte)
  hint?: string; // Indice optionnel
  timeLimit?: number; // Temps imparti en secondes (par défaut: 5)
}

export type QuestionsData = Record<Category, Question[]>;

