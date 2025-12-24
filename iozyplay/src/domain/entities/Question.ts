/**
 * Entité métier : Question
 * Représente une question dans le jeu
 */
import { Category, MediaType } from '../value-objects'

export interface QuestionData {
  id: string
  category: Category
  type: MediaType
  mediaUrl: string
  answer: string
  options?: string[]
  hint?: string
  timeLimit?: number
}

export class QuestionEntity {
  constructor(
    public readonly id: string,
    public readonly category: Category,
    public readonly type: MediaType,
    public readonly mediaUrl: string,
    public readonly answer: string,
    public readonly options?: string[],
    public readonly hint?: string,
    public readonly timeLimit?: number
  ) {}

  /**
   * Vérifie si une réponse est correcte
   */
  checkAnswer(userAnswer: string): boolean {
    const normalizedUserAnswer = userAnswer.toLowerCase().trim().replace(/\s+/g, ' ')
    const normalizedCorrectAnswer = this.answer.toLowerCase().trim().replace(/\s+/g, ' ')
    return normalizedUserAnswer === normalizedCorrectAnswer
  }

  /**
   * Vérifie si la question a un indice
   */
  hasHint(): boolean {
    return !!this.hint && this.hint.trim().length > 0
  }

  /**
   * Convertit l'entité en objet simple
   */
  toPlainObject(): QuestionData {
    return {
      id: this.id,
      category: this.category,
      type: this.type,
      mediaUrl: this.mediaUrl,
      answer: this.answer,
      options: this.options,
      hint: this.hint,
      timeLimit: this.timeLimit
    }
  }

  /**
   * Crée une entité depuis un objet simple
   */
  static fromPlainObject(data: QuestionData): QuestionEntity {
    return new QuestionEntity(
      data.id,
      data.category,
      data.type,
      data.mediaUrl,
      data.answer,
      data.options,
      data.hint,
      data.timeLimit
    )
  }
}




