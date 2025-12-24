/**
 * Output Port : QuestionRepositoryPort
 * Interface pour le repository de questions (Hexagonal Architecture)
 */
import { QuestionEntity } from '../../domain/entities/Question'
import { Category } from '../../domain/value-objects'

export interface QuestionRepositoryPort {
  /**
   * Récupère toutes les questions d'une catégorie
   */
  getQuestionsByCategory(category: Category): QuestionEntity[]

  /**
   * Récupère toutes les questions
   */
  getAllQuestions(): QuestionEntity[]

  /**
   * Sauvegarde les questions
   */
  saveQuestions(questions: QuestionEntity[]): Promise<void>

  /**
   * Charge les questions organisées par catégorie
   */
  loadQuestionsByCategory(): Promise<Record<Category, QuestionEntity[]>>
}




