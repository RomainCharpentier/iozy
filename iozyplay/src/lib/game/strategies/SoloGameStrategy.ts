import type { Question } from '@/types'
import type { Player } from '@/lib/game/types'
import { disconnectSocketIfConnected } from '@/utils/socket'
import type { GameModeStrategy, ValidateAnswersContext } from '@/lib/game/strategies/GameModeStrategy'

export interface SoloGameStrategyDeps {
  soloAnswersRef: { current: string[] }
}

export class SoloGameStrategy implements GameModeStrategy {
  constructor(private readonly deps: SoloGameStrategyDeps) {}

  getInitialQuestions(questions: Question[]): Question[] {
    return questions
  }

  getInitialGameStarted(): boolean {
    return true
  }

  getInitialWaitingForGo(): boolean {
    return false
  }

  submitAnswer(answer: string): void {
    this.deps.soloAnswersRef.current.push(answer)
  }

  validateAnswers(context: ValidateAnswersContext): void {
    const { gameQuestions, currentQuestionIndex, soloAnswersRef, setScore, setCorrectPlayers } =
      context
    const currentQuestion = gameQuestions[currentQuestionIndex]
    if (!currentQuestion) return

    const correctAnswer = currentQuestion.answer.toLowerCase().trim()
    let hasCorrect = false

    for (const answer of soloAnswersRef.current) {
      const isCorrect = answer.toLowerCase().trim() === correctAnswer
      if (isCorrect) {
        hasCorrect = true
        break
      }
    }

    if (hasCorrect) {
      setScore((prev) => prev + 1)
      setCorrectPlayers(() => new Set(['solo']))
    }

    soloAnswersRef.current = []
  }

  leaveRoom(): void {
    disconnectSocketIfConnected()
  }

  getPlayerId(): string {
    return 'solo'
  }

  getDisplayScore(score: number, _gamePlayers: Player[]): number {
    return score
  }

  onMount(): void {
    disconnectSocketIfConnected()
  }

  clearAnswersForNextQuestion(): void {
    this.deps.soloAnswersRef.current = []
  }
}
