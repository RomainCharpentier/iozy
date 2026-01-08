import type { Question } from '../../types'

export type GameMode = 'solo' | 'online';

export interface Player {
  id: string; // playerId (UUID persistant)
  name: string;
  score: number;
  isHost?: boolean;
  socketId?: string; // socket.id (peut changer à chaque reconnexion)
  connected?: boolean; // état de connexion
  disconnectedAt?: number; // timestamp de déconnexion
}

export interface GameState {
  currentQuestionIndex: number;
  score: number;
  selectedCategories: string[];
  questions: Question[];
  isGameActive: boolean;
  gameMode?: GameMode;
  players?: Player[];
}

