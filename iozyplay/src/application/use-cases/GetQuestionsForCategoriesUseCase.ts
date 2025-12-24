/**
 * Use Case : GetQuestionsForCategoriesUseCase
 * Cas d'usage pour récupérer les questions par catégories
 */
import { QuestionEntity } from '../../domain/entities/Question'
import { Category } from '../../domain/value-objects'
import { QuestionRepositoryPort } from '../../ports/output/QuestionRepositoryPort'
import { QuestionDomainService } from '../../domain/services/QuestionDomainService'

export interface GetQuestionsForCategoriesRequest {
  categories: Category[]
}

export class GetQuestionsForCategoriesUseCase {
  constructor(
    private questionRepository: QuestionRepositoryPort,
    private questionDomainService: QuestionDomainService
  ) {}

  async execute(
    request: GetQuestionsForCategoriesRequest
  ): Promise<QuestionEntity[]> {
    // Récupérer toutes les questions
    const allQuestions = this.questionRepository.getAllQuestions()

    // Filtrer par catégories
    return this.questionDomainService.filterByCategories(
      allQuestions,
      request.categories
    )
  }
}




