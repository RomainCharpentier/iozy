/**
 * Use Case : PrepareGameQuestionsUseCase
 * Cas d'usage pour préparer les questions d'une partie
 */
import { QuestionEntity } from '../../domain/entities/Question'
import { Category } from '../../domain/value-objects'
import { QuestionRepositoryPort } from '../../ports/output/QuestionRepositoryPort'
import { QuestionDomainService } from '../../domain/services/QuestionDomainService'

export interface PrepareGameQuestionsRequest {
  categories: Category[]
  questionCount: number
  timeLimit: number
}

export class PrepareGameQuestionsUseCase {
  constructor(
    private questionRepository: QuestionRepositoryPort,
    private questionDomainService: QuestionDomainService
  ) {}

  async execute(
    request: PrepareGameQuestionsRequest
  ): Promise<QuestionEntity[]> {
    // 1. Récupérer les questions pour les catégories
    const allQuestions = this.questionRepository.getAllQuestions()
    const filteredQuestions = this.questionDomainService.filterByCategories(
      allQuestions,
      request.categories
    )

    // 2. Mélanger les questions
    const shuffledQuestions = this.questionDomainService.shuffleQuestions(
      filteredQuestions
    )

    // 3. Limiter le nombre de questions
    const limitedQuestions = this.questionDomainService.limitQuestions(
      shuffledQuestions,
      request.questionCount
    )

    // 4. Appliquer le timer par défaut
    return this.questionDomainService.applyDefaultTimeLimit(
      limitedQuestions,
      request.timeLimit
    )
  }
}




