/**
 * Domaine métier pur - Logique de jeu
 * Aucune dépendance externe
 */

import { Question, Player, GameMode } from '../types';

export interface GameState {
  currentQuestionIndex: number;
  score: number;
  questions: Question[];
  players: Player[];
  gameMode: GameMode;
}

export class GameDomain {
  /**
   * Calcule le score en pourcentage
   */
  calculatePercentage(score: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 0;
    return Math.round((score / totalQuestions) * 100);
  }

  /**
   * Détermine le message de score basé sur le pourcentage
   */
  getScoreMessage(percentage: number): string {
    if (percentage === 100) return '🎉 Parfait ! 🎉';
    if (percentage >= 80) return '🌟 Excellent !';
    if (percentage >= 60) return '👍 Bien joué !';
    if (percentage >= 40) return '💪 Pas mal !';
    return '💪 Continue comme ça !';
  }

  /**
   * Détermine le gagnant en mode multijoueur
   */
  getWinner(players: Player[]): Player | null {
    if (players.length === 0) return null;
    
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const maxScore = sortedPlayers[0].score;
    const winners = sortedPlayers.filter(p => p.score === maxScore);
    
    return winners.length === 1 ? winners[0] : null;
  }

  /**
   * Vérifie si la partie est terminée
   */
  isGameFinished(currentQuestionIndex: number, totalQuestions: number): boolean {
    return currentQuestionIndex >= totalQuestions - 1;
  }

  /**
   * Vérifie si on peut passer à la question suivante
   */
  canGoToNextQuestion(currentQuestionIndex: number, totalQuestions: number): boolean {
    return currentQuestionIndex + 1 < totalQuestions;
  }

  /**
   * Calcule le pourcentage de progression
   */
  calculateProgress(currentQuestionIndex: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 0;
    return ((currentQuestionIndex + 1) / totalQuestions) * 100;
  }

  /**
   * Réinitialise les scores des joueurs
   */
  resetPlayerScores(players: Player[]): Player[] {
    return players.map(p => ({ ...p, score: 0 }));
  }
}







