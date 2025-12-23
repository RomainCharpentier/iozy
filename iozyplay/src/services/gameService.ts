/**
 * Service de jeu - Facade pour le domaine de jeu
 * Utilise le domaine métier pur
 */

import { Player } from '../types';
import { GameDomain } from '../domain/game';

const gameDomain = new GameDomain();

/**
 * Service de jeu - API publique
 */
export class GameService {
  /**
   * Calcule le score en pourcentage
   */
  static calculatePercentage(score: number, totalQuestions: number): number {
    return gameDomain.calculatePercentage(score, totalQuestions);
  }

  /**
   * Détermine le message de score basé sur le pourcentage
   */
  static getScoreMessage(percentage: number): string {
    return gameDomain.getScoreMessage(percentage);
  }

  /**
   * Détermine le gagnant en mode multijoueur
   */
  static getWinner(players: Player[]): Player | null {
    return gameDomain.getWinner(players);
  }

  /**
   * Vérifie si la partie est terminée
   */
  static isGameFinished(currentQuestionIndex: number, totalQuestions: number): boolean {
    return gameDomain.isGameFinished(currentQuestionIndex, totalQuestions);
  }

  /**
   * Vérifie si on peut passer à la question suivante
   */
  static canGoToNextQuestion(currentQuestionIndex: number, totalQuestions: number): boolean {
    return gameDomain.canGoToNextQuestion(currentQuestionIndex, totalQuestions);
  }

  /**
   * Calcule le pourcentage de progression
   */
  static calculateProgress(currentQuestionIndex: number, totalQuestions: number): number {
    return gameDomain.calculateProgress(currentQuestionIndex, totalQuestions);
  }

  /**
   * Réinitialise les scores des joueurs
   */
  static resetPlayerScores(players: Player[]): Player[] {
    return gameDomain.resetPlayerScores(players);
  }
}






