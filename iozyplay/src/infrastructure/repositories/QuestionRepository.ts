/**
 * Infrastructure : QuestionRepository
 * Implémentation concrète du QuestionRepositoryPort
 */
import { QuestionEntity, QuestionData } from '../../domain/entities/Question'
import { Category } from '../../domain/value-objects'
import { QuestionRepositoryPort } from '../../ports/output/QuestionRepositoryPort'
import { StoragePort } from '../../ports/output/StoragePort'
import questionsData from '../../data/questions.json'

export interface QuestionsData {
  [key: string]: QuestionData[]
}

export class QuestionRepository implements QuestionRepositoryPort {
  private readonly STORAGE_KEY = 'blindtest-questions'

  constructor(private storage: StoragePort) {}

  getQuestionsByCategory(category: Category): QuestionEntity[] {
    const allData = this.getAllQuestionsData()
    const categoryQuestions = allData[category] || []
    return categoryQuestions.map(q => QuestionEntity.fromPlainObject(q))
  }

  getAllQuestions(): QuestionEntity[] {
    const allData = this.getAllQuestionsData()
    const all: QuestionData[] = []
    Object.values(allData).forEach(categoryQuestions => {
      all.push(...categoryQuestions)
    })
    return all.map(q => QuestionEntity.fromPlainObject(q))
  }

  async saveQuestions(questions: QuestionEntity[]): Promise<void> {
    const organized: QuestionsData = {
      chansons: [],
      series: [],
      animes: [],
      films: [],
      jeux: []
    }

    questions.forEach(q => {
      organized[q.category].push(q.toPlainObject())
    })

    await this.storage.setItem(this.STORAGE_KEY, JSON.stringify(organized))
  }

  async loadQuestionsByCategory(): Promise<Record<Category, QuestionEntity[]>> {
    const saved = this.storage.getItem(this.STORAGE_KEY)
    let data: QuestionsData

    if (saved) {
      try {
        data = JSON.parse(saved) as QuestionsData
      } catch (e) {
        console.error('Erreur lors du chargement des questions:', e)
        data = this.getDefaultQuestionsData()
      }
    } else {
      data = this.getDefaultQuestionsData()
    }

    // Fusionner avec les données par défaut
    const defaultData = this.getDefaultQuestionsData()
    const merged: QuestionsData = {
      chansons: [...(data.chansons || []), ...(defaultData.chansons || [])],
      series: [...(data.series || []), ...(defaultData.series || [])],
      animes: [...(data.animes || []), ...(defaultData.animes || [])],
      films: [...(data.films || []), ...(defaultData.films || [])],
      jeux: [...(data.jeux || []), ...(defaultData.jeux || [])],
    }

    const result: Record<Category, QuestionEntity[]> = {
      chansons: (merged.chansons || []).map(q => QuestionEntity.fromPlainObject(q)),
      series: (merged.series || []).map(q => QuestionEntity.fromPlainObject(q)),
      animes: (merged.animes || []).map(q => QuestionEntity.fromPlainObject(q)),
      films: (merged.films || []).map(q => QuestionEntity.fromPlainObject(q)),
      jeux: (merged.jeux || []).map(q => QuestionEntity.fromPlainObject(q)),
    }

    return result
  }

  private getAllQuestionsData(): QuestionsData {
    const saved = this.storage.getItem(this.STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as QuestionsData
        const defaultData = this.getDefaultQuestionsData()
        return {
          chansons: [...(parsed.chansons || []), ...(defaultData.chansons || [])],
          series: [...(parsed.series || []), ...(defaultData.series || [])],
          animes: [...(parsed.animes || []), ...(defaultData.animes || [])],
          films: [...(parsed.films || []), ...(defaultData.films || [])],
          jeux: [...(parsed.jeux || []), ...(defaultData.jeux || [])],
        }
      } catch (e) {
        return this.getDefaultQuestionsData()
      }
    }
    return this.getDefaultQuestionsData()
  }

  private getDefaultQuestionsData(): QuestionsData {
    return questionsData as QuestionsData
  }
}




