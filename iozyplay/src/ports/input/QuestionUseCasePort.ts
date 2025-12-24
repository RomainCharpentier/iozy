/**
 * Input Port : QuestionUseCasePort
 * Interface pour les cas d'usage des questions (Hexagonal Architecture)
 */
import { QuestionEntity } from '../../domain/entities/Question'
import { Category } from '../../domain/value-objects'

export interface GetQuestionsForCategoriesRequest {
  categories: Category[]
}

export interface ShuffleAndLimitQuestionsRequest {
  questions: QuestionEntity[]
  limit: number
}

export interface ApplyTimeLimitRequest {
  questions: QuestionEntity[]
  timeLimit: number
}

export interface QuestionUseCasePort {
  /**
   * Récupère les questions pour les catégories données
   */
  getQuestionsForCategories(
    request: GetQuestionsForCategoriesRequest
  ): Promise<QuestionEntity[]>

  /**
   * Mélange et limite le nombre de questions
   */
  shuffleAndLimitQuestions(
    request: ShuffleAndLimitQuestionsRequest
  ): Promise<QuestionEntity[]>

  /**
   * Applique un timer par défaut aux questions
   */
  applyTimeLimit(
    request: ApplyTimeLimitRequest
  ): Promise<QuestionEntity[]>

  /**
   * Génère un ID pour une nouvelle question
   */
  generateQuestionId(category: Category): Promise<string>
}




