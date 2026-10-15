import type { Question } from '@/types'
import type { Player } from '@/lib/game/types'
import { disconnectSocketIfConnected } from '@/utils/socket'
import { compareAnswers } from '@/utils/answerNormalization'
import { randomStartFraction } from '@/utils/timecode'
import type {
  GameModeStrategy,
  ValidateAnswersContext,
} from '@/lib/game/strategies/GameModeStrategy'

export interface SoloGameStrategyDeps {
  soloAnswersRef: { current: string[] }
}

export class SoloGameStrategy implements GameModeStrategy {
  constructor(private readonly deps: SoloGameStrategyDeps) {}

  // Départ aléatoire de chaque extrait, tiré à chaque partie (en ligne : par le serveur)
  getInitialQuestions(questions: Question[]): Question[] {
    return questions.map((question) => ({ ...question, startFraction: randomStartFraction() }))
  }

  getInitialGameStarted(): boolean {
    return true
  }

  getInitialWaitingForGo(): boolean {
    return false
  }

  // Une seule réponse par question : la dernière saisie remplace la précédente (comme
  // storeAnswer côté serveur) ; un champ vidé retire la réponse.
  submitAnswer(answer: string): void {
    const trimmed = answer.trim()
    this.deps.soloAnswersRef.current = trimmed ? [trimmed] : []
  }

  validateAnswers(context: ValidateAnswersContext): void {
    const { gameQuestions, currentQuestionIndex, soloAnswersRef, setScore, setCorrectPlayers } =
      context
    const currentQuestion = gameQuestions[currentQuestionIndex]
    if (!currentQuestion) {
      console.log('[SoloGameStrategy] validateAnswers: no current question')
      return
    }

    const correctAnswer = currentQuestion.answer
    let hasCorrect = false
    for (const answer of soloAnswersRef.current) {
      const isCorrect = compareAnswers(answer.trim(), correctAnswer)
      if (isCorrect) {
        hasCorrect = true
        break
      }
    }

    if (hasCorrect) {
      setScore((prev) => prev + 1)
    }
    // Résultat de CETTE question (affiché au reveal) : sans remise à zéro, une bonne
    // réponse précédente restait affichée comme correcte
    setCorrectPlayers(() => (hasCorrect ? new Set(['solo']) : new Set()))

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
