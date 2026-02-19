/**
 * Configuration avancée du jeu
 */

export interface GameConfig {
  // Timing
  timeLimit: number // Temps par question en secondes
  revealDelay: number // Délai avant révélation de la réponse (ms)
  transitionDelay: number // Délai entre les questions (ms)

  // Questions
  questionCount: number // Nombre de questions
  shuffleQuestions: boolean // Mélanger les questions

  // Difficulté
  difficulty: 'easy' | 'normal' | 'hard'

  // Multijoueur
  maxPlayers: number // Nombre maximum de joueurs
  autoStart: boolean // Démarrer automatiquement quand tous sont prêts

  // Options avancées
  showHints: boolean // Afficher les indices
  allowSkip: boolean // Permettre de passer une question
  penaltyOnWrong: boolean // Pénalité sur mauvaise réponse
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  timeLimit: 5,
  revealDelay: 5000,
  transitionDelay: 3000,
  questionCount: 10,
  shuffleQuestions: true,
  difficulty: 'normal',
  maxPlayers: 10,
  autoStart: false,
  showHints: true,
  allowSkip: false,
  penaltyOnWrong: false,
}

export const DIFFICULTY_CONFIGS = {
  easy: {
    timeLimit: 10,
    showHints: true,
    penaltyOnWrong: false,
  },
  normal: {
    timeLimit: 5,
    showHints: true,
    penaltyOnWrong: false,
  },
  hard: {
    timeLimit: 3,
    showHints: false,
    penaltyOnWrong: true,
  },
} as const
