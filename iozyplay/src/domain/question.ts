/**
 * Domaine métier pur - Gestion des questions
 * Aucune dépendance externe (pas de React, npm, localStorage, etc.)
 */

import { Question, Category } from '../types';

export interface QuestionsRepository {
  getQuestionsByCategory(category: Category): Question[];
  getAllQuestions(): Question[];
  saveQuestions(questions: Question[]): void;
  loadQuestions(): Record<Category, Question[]>;
}

export class QuestionDomain {
  constructor(private repository: QuestionsRepository) {}

  /**
   * Récupère toutes les questions pour les catégories sélectionnées
   */
  getQuestionsForCategories(categories: Category[]): Question[] {
    const allQuestions: Question[] = [];
    categories.forEach(category => {
      const categoryQuestions = this.repository.getQuestionsByCategory(category);
      allQuestions.push(...categoryQuestions);
    });
    return allQuestions;
  }

  /**
   * Mélange un tableau de questions (algorithme Fisher-Yates)
   */
  shuffleQuestions(questions: Question[]): Question[] {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Applique un timer par défaut à toutes les questions
   */
  applyDefaultTimeLimit(questions: Question[], timeLimit: number): Question[] {
    return questions.map(q => ({
      ...q,
      timeLimit: timeLimit
    }));
  }

  /**
   * Génère un ID automatique pour une question basé sur la catégorie
   */
  generateId(category: Category): string {
    const categoryQuestions = this.repository.getQuestionsByCategory(category);
    const existingIds = categoryQuestions.map(q => q.id);
    let counter = 1;
    let newId = `${category}-${counter}`;
    
    while (existingIds.includes(newId)) {
      counter++;
      newId = `${category}-${counter}`;
    }
    
    return newId;
  }

  /**
   * Organise les questions par catégorie
   */
  organizeByCategory(questions: Question[]): Record<Category, Question[]> {
    const organized: Record<Category, Question[]> = {
      chansons: [],
      series: [],
      animes: [],
      films: [],
      jeux: []
    };

    questions.forEach(q => {
      organized[q.category].push(q);
    });

    return organized;
  }

  /**
   * Sauvegarde les questions via le repository
   */
  saveQuestions(questions: Question[]): void {
    this.repository.saveQuestions(questions);
  }

  /**
   * Charge les questions via le repository
   */
  loadQuestions(): Record<Category, Question[]> {
    return this.repository.loadQuestions();
  }
}







