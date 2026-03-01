import type { Question } from '@/types'
import type { Player } from '@/lib/game/types'

/** Contexte pour la validation des réponses (mode solo) */
export interface ValidateAnswersContext {
  gameQuestions: Question[]
  currentQuestionIndex: number
  soloAnswersRef: { current: string[] }
  setScore: (updater: (prev: number) => number) => void
  setCorrectPlayers: (updater: (prev: Set<string>) => Set<string>) => void
}

/** Contrat des stratégies de mode de jeu (solo vs online) */
export interface GameModeStrategy {
  /** Questions initiales (solo: from props, online: []) */
  getInitialQuestions(questions: Question[]): Question[]

  /** La partie démarre directement en solo, attend le serveur en online */
  getInitialGameStarted(): boolean

  /** En online on attend le signal "go", pas en solo */
  getInitialWaitingForGo(): boolean

  /** Soumettre une réponse (solo: stocker localement, online: emit socket) */
  submitAnswer(answer: string): void

  /** Valider les réponses à la fin de la phase guess (solo: validateSoloAnswers, online: no-op serveur) */
  validateAnswers(context: ValidateAnswersContext): void

  /** Quitter la room (solo: disconnectSocket, online: room:leave) */
  leaveRoom(): void

  /** ID du joueur pour l'affichage (solo: 'solo', online: getPlayerId()) */
  getPlayerId(): string

  /** Score à afficher (solo: score local, online: score du joueur depuis gamePlayers) */
  getDisplayScore(score: number, gamePlayers: Player[]): number

  /** Hook appelé au mount du composant (solo: disconnect socket) */
  onMount?(): void

  /** Réinitialiser les réponses stockées pour une nouvelle question */
  clearAnswersForNextQuestion?(): void
}
