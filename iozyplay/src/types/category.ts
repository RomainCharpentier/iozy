export type Category = 'series' | 'animes' | 'chansons' | 'films' | 'jeux';

export interface CategoryInfo {
  id: Category;
  name: string;
  emoji: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'chansons', name: 'Chansons', emoji: '🎵' },
  { id: 'series', name: 'Séries TV', emoji: '📺' },
  { id: 'animes', name: 'Animes', emoji: '🎌' },
  { id: 'films', name: 'Films', emoji: '🎬' },
  { id: 'jeux', name: 'Jeux vidéo', emoji: '🎮' },
];







