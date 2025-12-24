/**
 * Service de jeu - Logique métier pour le jeu
 */
import type { Player } from '../lib/game/types'

export const TIMING = {
  QUESTION_TRANSITION_DELAY: 3000,
  REVEAL_DELAY: 5000,
  COUNTDOWN_WARNING_THRESHOLD: 3,
  TIMER_INTERVAL: 1000,
  DEFAULT_TIME_LIMIT: 5,
  MIN_TIME_LIMIT: 5,
  MAX_TIME_LIMIT: 30,
  CONNECTION_TIMEOUT: 10000,
  GAME_START_DELAY: 500,
  ROOM_JOIN_DELAY: 1000,
} as const

export const QUESTION_COUNT = {
  DEFAULT: 10,
  MIN: 5,
  MAX: 50,
} as const

/**
 * Service de jeu - API publique
 */
export class GameService {
  /**
   * Calcule le score en pourcentage
   */
  static calculatePercentage(score: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 0
    return Math.round((score / totalQuestions) * 100)
  }

  /**
   * Détermine le message de score basé sur le pourcentage
   */
  static getScoreMessage(percentage: number): string {
    if (percentage === 100) return '🎉 Parfait ! 🎉'
    if (percentage >= 80) return '🌟 Excellent !'
    if (percentage >= 60) return '👍 Bien joué !'
    if (percentage >= 40) return '💪 Pas mal !'
    return '💪 Continue comme ça !'
  }

  /**
   * Détermine le gagnant en mode multijoueur
   */
  static getWinner(players: Player[]): Player | null {
    if (players.length === 0) return null
    
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
    const maxScore = sortedPlayers[0].score
    const winners = sortedPlayers.filter(p => p.score === maxScore)
    
    return winners.length === 1 ? winners[0] : null
  }

  /**
   * Vérifie si la partie est terminée
   */
  static isGameFinished(currentQuestionIndex: number, totalQuestions: number): boolean {
    return currentQuestionIndex >= totalQuestions - 1
  }

  /**
   * Vérifie si on peut passer à la question suivante
   */
  static canGoToNextQuestion(currentQuestionIndex: number, totalQuestions: number): boolean {
    return currentQuestionIndex + 1 < totalQuestions
  }

  /**
   * Calcule le pourcentage de progression
   */
  static calculateProgress(currentQuestionIndex: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 0
    return ((currentQuestionIndex + 1) / totalQuestions) * 100
  }

  /**
   * Réinitialise les scores des joueurs
   */
  static resetPlayerScores(players: Player[]): Player[] {
    return players.map(p => ({ ...p, score: 0 }))
  }
}
