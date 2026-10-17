export type Category = string // Catégories dynamiques

export interface CategoryInfo {
  id: Category
  name: string
  emoji: string // Stocke un emoji (ex: "🎵") ou un ID d'icône pour rétrocompatibilité
}

// Catégories par défaut (seront remplacées par celles du serveur)
export const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { id: 'chansons', name: 'Chansons', emoji: '🎵' },
  { id: 'series', name: 'Séries TV', emoji: '📺' },
  { id: 'animes', name: 'Animes', emoji: '🎌' },
  { id: 'films', name: 'Films', emoji: '🎬' },
  { id: 'jeux', name: 'Jeux vidéo', emoji: '🎮' },
]

// Alias pour rétrocompatibilité
export const CATEGORIES = DEFAULT_CATEGORIES
