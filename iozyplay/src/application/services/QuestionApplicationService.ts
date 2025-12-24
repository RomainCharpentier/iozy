/**
 * Application Service : QuestionApplicationService
 * Orchestre les use cases et domain services pour les questions
 */
import { QuestionEntity } from '../../domain/entities/Question'
import { Category } from '../../domain/value-objects'
import { QuestionRepositoryPort } from '../../ports/output/QuestionRepositoryPort'
import { QuestionDomainService } from '../../domain/services/QuestionDomainService'
import { GetQuestionsForCategoriesUseCase } from '../use-cases/GetQuestionsForCategoriesUseCase'
import { PrepareGameQuestionsUseCase } from '../use-cases/PrepareGameQuestionsUseCase'

export class QuestionApplicationService {
  private getQuestionsForCategoriesUseCase: GetQuestionsForCategoriesUseCase
  private prepareGameQuestionsUseCase: PrepareGameQuestionsUseCase

  constructor(
    private questionRepository: QuestionRepositoryPort,
    private questionDomainService: QuestionDomainService
  ) {
    this.getQuestionsForCategoriesUseCase = new GetQuestionsForCategoriesUseCase(
      questionRepository,
      questionDomainService
    )
    this.prepareGameQuestionsUseCase = new PrepareGameQuestionsUseCase(
      questionRepository,
      questionDomainService
    )
  }

  /**
   * Récupère les questions pour les catégories données
   */
  async getQuestionsForCategories(
    categories: Category[]
  ): Promise<QuestionEntity[]> {
    return this.getQuestionsForCategoriesUseCase.execute({ categories })
  }

  /**
   * Prépare les questions pour une partie
   */
  async prepareGameQuestions(
    categories: Category[],
    questionCount: number,
    timeLimit: number
  ): Promise<QuestionEntity[]> {
    return this.prepareGameQuestionsUseCase.execute({
      categories,
      questionCount,
      timeLimit
    })
  }

  /**
   * Mélange les questions
   */
  shuffleQuestions(questions: QuestionEntity[]): QuestionEntity[] {
    return this.questionDomainService.shuffleQuestions(questions)
  }

  /**
   * Applique un timer par défaut
   */
  applyDefaultTimeLimit(
    questions: QuestionEntity[],
    timeLimit: number
  ): QuestionEntity[] {
    return this.questionDomainService.applyDefaultTimeLimit(questions, timeLimit)
  }

  /**
   * Génère un ID pour une nouvelle question
   */
  async generateQuestionId(category: Category): Promise<string> {
    const categoryQuestions = this.questionRepository.getQuestionsByCategory(category)
    const existingIds = categoryQuestions.map(q => q.id)
    let counter = 1
    let newId = `${category}-${counter}`
    
    while (existingIds.includes(newId)) {
      counter++
      newId = `${category}-${counter}`
    }
    
    return newId
  }
}




