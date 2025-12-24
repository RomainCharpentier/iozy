/**
 * Application Service : GameApplicationService
 * Orchestre les use cases et domain services pour le jeu
 */
import { PlayerEntity } from '../../domain/entities/Player'
import { QuestionEntity } from '../../domain/entities/Question'
import { Score, Progress, GameMode } from '../../domain/value-objects'
import { GameDomainService } from '../../domain/services/GameDomainService'

export class GameApplicationService {
  constructor(private gameDomainService: GameDomainService) {}

  /**
   * Calcule le score en pourcentage
   */
  calculatePercentage(score: number, totalQuestions: number): number {
    const scoreObj = new Score(score, totalQuestions)
    return scoreObj.getPercentage()
  }

  /**
   * Détermine le message de score
   */
  getScoreMessage(percentage: number): string {
    return this.gameDomainService.getScoreMessage(percentage)
  }

  /**
   * Détermine le gagnant
   */
  getWinner(players: PlayerEntity[]): PlayerEntity | null {
    return this.gameDomainService.getWinner(players)
  }

  /**
   * Calcule la progression
   */
  calculateProgress(currentQuestionIndex: number, totalQuestions: number): number {
    const progress = new Progress(currentQuestionIndex, totalQuestions)
    return progress.getPercentage()
  }

  /**
   * Vérifie si on peut passer à la question suivante
   */
  canGoToNextQuestion(currentQuestionIndex: number, totalQuestions: number): boolean {
    const progress = new Progress(currentQuestionIndex, totalQuestions)
    return progress.canGoToNext()
  }

  /**
   * Réinitialise les scores des joueurs
   */
  resetPlayerScores(players: PlayerEntity[]): PlayerEntity[] {
    const playersCopy = players.map(p => PlayerEntity.fromPlainObject(p.toPlainObject()))
    this.gameDomainService.resetAllPlayerScores(playersCopy)
    return playersCopy
  }
}




