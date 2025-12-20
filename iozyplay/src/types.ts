export type Category = 'series' | 'animes' | 'chansons' | 'films' | 'jeux';
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

export type GameMode = 'solo' | 'online';

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost?: boolean;
}

export interface GameState {
  currentQuestionIndex: number;
  score: number;
  selectedCategories: Category[];
  questions: Question[];
  isGameActive: boolean;
  gameMode?: GameMode;
  players?: Player[];
}


