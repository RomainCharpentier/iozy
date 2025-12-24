/**
 * Dependency Injection Container
 * Assemble toutes les couches selon Clean Architecture
 */
import { GameDomainService } from '../../domain/services/GameDomainService'
import { QuestionDomainService } from '../../domain/services/QuestionDomainService'
import { GameApplicationService } from '../../application/services/GameApplicationService'
import { QuestionApplicationService } from '../../application/services/QuestionApplicationService'
import { QuestionRepository } from '../repositories/QuestionRepository'
import { LocalStorageAdapter } from '../adapters/LocalStorageAdapter'
import { SocketAdapter } from '../adapters/SocketAdapter'
import { GetQuestionsForCategoriesUseCase } from '../../application/use-cases/GetQuestionsForCategoriesUseCase'
import { PrepareGameQuestionsUseCase } from '../../application/use-cases/PrepareGameQuestionsUseCase'

/**
 * Container de dépendances
 * Singleton pour gérer les instances
 */
class DIContainer {
  // Domain Services
  private _gameDomainService?: GameDomainService
  private _questionDomainService?: QuestionDomainService

  // Application Services
  private _gameApplicationService?: GameApplicationService
  private _questionApplicationService?: QuestionApplicationService

  // Infrastructure
  private _storageAdapter?: LocalStorageAdapter
  private _socketAdapter?: SocketAdapter
  private _questionRepository?: QuestionRepository

  // Use Cases
  private _getQuestionsForCategoriesUseCase?: GetQuestionsForCategoriesUseCase
  private _prepareGameQuestionsUseCase?: PrepareGameQuestionsUseCase

  // Domain Services
  get gameDomainService(): GameDomainService {
    if (!this._gameDomainService) {
      this._gameDomainService = new GameDomainService()
    }
    return this._gameDomainService
  }

  get questionDomainService(): QuestionDomainService {
    if (!this._questionDomainService) {
      this._questionDomainService = new QuestionDomainService()
    }
    return this._questionDomainService
  }

  // Infrastructure Adapters
  get storageAdapter(): LocalStorageAdapter {
    if (!this._storageAdapter) {
      this._storageAdapter = new LocalStorageAdapter()
    }
    return this._storageAdapter
  }

  get socketAdapter(): SocketAdapter {
    if (!this._socketAdapter) {
      const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
      this._socketAdapter = new SocketAdapter(url)
      this._socketAdapter.connect()
    }
    return this._socketAdapter
  }

  // Repositories
  get questionRepository(): QuestionRepository {
    if (!this._questionRepository) {
      this._questionRepository = new QuestionRepository(this.storageAdapter)
    }
    return this._questionRepository
  }

  // Use Cases
  get getQuestionsForCategoriesUseCase(): GetQuestionsForCategoriesUseCase {
    if (!this._getQuestionsForCategoriesUseCase) {
      this._getQuestionsForCategoriesUseCase = new GetQuestionsForCategoriesUseCase(
        this.questionRepository,
        this.questionDomainService
      )
    }
    return this._getQuestionsForCategoriesUseCase
  }

  get prepareGameQuestionsUseCase(): PrepareGameQuestionsUseCase {
    if (!this._prepareGameQuestionsUseCase) {
      this._prepareGameQuestionsUseCase = new PrepareGameQuestionsUseCase(
        this.questionRepository,
        this.questionDomainService
      )
    }
    return this._prepareGameQuestionsUseCase
  }

  // Application Services
  get gameApplicationService(): GameApplicationService {
    if (!this._gameApplicationService) {
      this._gameApplicationService = new GameApplicationService(this.gameDomainService)
    }
    return this._gameApplicationService
  }

  get questionApplicationService(): QuestionApplicationService {
    if (!this._questionApplicationService) {
      this._questionApplicationService = new QuestionApplicationService(
        this.questionRepository,
        this.questionDomainService
      )
    }
    return this._questionApplicationService
  }
}

// Export singleton
export const container = new DIContainer()




