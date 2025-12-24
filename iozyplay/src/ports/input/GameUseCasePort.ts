/**
 * Input Port : GameUseCasePort
 * Interface pour les cas d'usage du jeu (Hexagonal Architecture)
 */
import { QuestionEntity } from '../../domain/entities/Question'
import { PlayerEntity } from '../../domain/entities/Player'
import { Category, GameMode } from '../../domain/value-objects'

export interface StartGameRequest {
  questions: QuestionEntity[]
  categories: Category[]
  players: PlayerEntity[]
  gameMode: GameMode
  timeLimit: number
}

export interface AnswerQuestionRequest {
  questionId: string
  answer: string
  playerId: string
}

export interface GameUseCasePort {
  /**
   * Démarre une nouvelle partie
   */
  startGame(request: StartGameRequest): Promise<void>

  /**
   * Traite une réponse à une question
   */
  answerQuestion(request: AnswerQuestionRequest): Promise<{
    isCorrect: boolean
    updatedPlayers: PlayerEntity[]
  }>

  /**
   * Passe à la question suivante
   */
  nextQuestion(): Promise<void>

  /**
   * Termine la partie
   */
  endGame(): Promise<void>
}




