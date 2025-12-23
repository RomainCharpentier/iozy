/**
 * Repository concret pour les questions utilisant localStorage
 */

import { Question, Category, QuestionsData } from '../../types';
import { QuestionsRepository } from '../../domain/question';
import { StoragePort } from '../../ports/storage';
import questionsData from '../../data/questions.json';

export class QuestionRepository implements QuestionsRepository {
  private readonly STORAGE_KEY = 'blindtest-questions';

  constructor(private storage: StoragePort) {}

  getQuestionsByCategory(category: Category): Question[] {
    const allData = this.getAllQuestionsData();
    return allData[category] || [];
  }

  getAllQuestions(): Question[] {
    const allData = this.getAllQuestionsData();
    const all: Question[] = [];
    Object.values(allData).forEach(categoryQuestions => {
      all.push(...categoryQuestions);
    });
    return all;
  }

  saveQuestions(questions: Question[]): void {
    const organized: QuestionsData = {
      chansons: [],
      series: [],
      animes: [],
      films: [],
      jeux: []
    };

    questions.forEach(q => {
      organized[q.category].push(q);
    });

    this.storage.setItem(this.STORAGE_KEY, JSON.stringify(organized));
  }

  loadQuestions(): QuestionsData {
    const saved = this.storage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as QuestionsData;
      } catch (e) {
        console.error('Erreur lors du chargement des questions:', e);
        return this.getDefaultQuestionsData();
      }
    }
    return this.getDefaultQuestionsData();
  }

  private getAllQuestionsData(): QuestionsData {
    const saved = this.loadQuestions();
    // Fusionner avec les données par défaut
    const defaultData = this.getDefaultQuestionsData();
    return {
      chansons: [...(saved.chansons || []), ...(defaultData.chansons || [])],
      series: [...(saved.series || []), ...(defaultData.series || [])],
      animes: [...(saved.animes || []), ...(defaultData.animes || [])],
      films: [...(saved.films || []), ...(defaultData.films || [])],
      jeux: [...(saved.jeux || []), ...(defaultData.jeux || [])],
    };
  }

  private getDefaultQuestionsData(): QuestionsData {
    return questionsData as QuestionsData;
  }
}







