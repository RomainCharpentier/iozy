/**
 * Domain Service : GameDomainService
 * Logique métier pure pour le jeu
 */
import { PlayerEntity } from '../entities/Player'
import { Score, Progress } from '../value-objects'

export class GameDomainService {
  /**
   * Calcule le message de score basé sur le pourcentage
   */
  getScoreMessage(percentage: number): string {
    if (percentage === 100) return '🎉 Parfait ! 🎉'
    if (percentage >= 80) return '🌟 Excellent !'
    if (percentage >= 60) return '👍 Bien joué !'
    if (percentage >= 40) return '💪 Pas mal !'
    return '💪 Continue comme ça !'
  }

  /**
   * Détermine le gagnant en mode multijoueur
   */
  getWinner(players: PlayerEntity[]): PlayerEntity | null {
    if (players.length === 0) return null
    
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
    const maxScore = sortedPlayers[0].score
    const winners = sortedPlayers.filter(p => p.score === maxScore)
    
    return winners.length === 1 ? winners[0] : null
  }

  /**
   * Réinitialise les scores de tous les joueurs
   */
  resetAllPlayerScores(players: PlayerEntity[]): void {
    players.forEach(player => player.resetScore())
  }
}




