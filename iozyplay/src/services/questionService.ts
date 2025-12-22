/**
 * Service de questions - Facade pour le domaine
 * Utilise le domaine métier pur avec une implémentation concrète
 */

import { Question, Category } from '../types';
import { QuestionDomain } from '../domain/question';
import { QuestionRepository } from '../infrastructure/storage/questionRepository';
import { LocalStorageAdapter } from '../infrastructure/storage/localStorageAdapter';

// Instance singleton du repository
const storageAdapter = new LocalStorageAdapter();
const questionRepository = new QuestionRepository(storageAdapter);
const questionDomain = new QuestionDomain(questionRepository);

/**
 * Service de questions - API publique
 * Cette couche peut être utilisée par React ou toute autre technologie
 */
export class QuestionService {
  /**
   * Récupère toutes les questions pour les catégories sélectionnées
   */
  static getQuestionsForCategories(categories: Category[]): Question[] {
    return questionDomain.getQuestionsForCategories(categories);
  }

  /**
   * Mélange un tableau de questions
   */
  static shuffleQuestions(questions: Question[]): Question[] {
    return questionDomain.shuffleQuestions(questions);
  }

  /**
   * Applique un timer par défaut à toutes les questions
   */
  static applyDefaultTimeLimit(questions: Question[], timeLimit: number): Question[] {
    return questionDomain.applyDefaultTimeLimit(questions, timeLimit);
  }

  /**
   * Génère un ID automatique pour une question basé sur la catégorie
   */
  static generateId(category: Category): string {
    return questionDomain.generateId(category);
  }

  /**
   * Récupère toutes les questions
   */
  static getAllQuestions(): Question[] {
    return questionRepository.getAllQuestions();
  }

  /**
   * Sauvegarde les questions dans localStorage
   */
  static saveQuestions(questions: Question[]): void {
    questionDomain.saveQuestions(questions);
  }

  /**
   * Charge les questions depuis localStorage
   */
  static loadQuestions(): Record<Category, Question[]> {
    return questionDomain.loadQuestions();
  }
}
