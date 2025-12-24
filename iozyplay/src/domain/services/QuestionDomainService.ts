/**
 * Domain Service : QuestionDomainService
 * Logique métier pure pour les questions
 */
import { QuestionEntity } from '../entities/Question'
import { Category } from '../value-objects'

export class QuestionDomainService {
  /**
   * Mélange un tableau de questions (algorithme Fisher-Yates)
   */
  shuffleQuestions(questions: QuestionEntity[]): QuestionEntity[] {
    const shuffled = [...questions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  /**
   * Applique un timer par défaut à toutes les questions
   */
  applyDefaultTimeLimit(
    questions: QuestionEntity[],
    timeLimit: number
  ): QuestionEntity[] {
    // Note: Comme QuestionEntity est immutable, on doit créer de nouvelles instances
    // Pour simplifier, on retourne les questions avec le timeLimit dans les données
    return questions.map(q => {
      const data = q.toPlainObject()
      data.timeLimit = timeLimit
      return QuestionEntity.fromPlainObject(data)
    })
  }

  /**
   * Filtre les questions par catégories
   */
  filterByCategories(
    questions: QuestionEntity[],
    categories: Category[]
  ): QuestionEntity[] {
    return questions.filter(q => categories.includes(q.category))
  }

  /**
   * Limite le nombre de questions
   */
  limitQuestions(
    questions: QuestionEntity[],
    limit: number
  ): QuestionEntity[] {
    return questions.slice(0, limit)
  }
}




