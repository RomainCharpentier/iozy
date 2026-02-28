import type { Question } from '@/types'
import type { Player } from '@/lib/game/types'
import { getSocket } from '@/utils/socket'
import { getPlayerId } from '@/utils/playerId'
import type { GameModeStrategy, ValidateAnswersContext } from '@/lib/game/strategies/GameModeStrategy'

export interface OnlineGameStrategyDeps {
  roomCode: string | null
}

export class OnlineGameStrategy implements GameModeStrategy {
  constructor(private readonly deps: OnlineGameStrategyDeps) {}

  getInitialQuestions(_questions: Question[]): Question[] {
    return [] // Les questions viennent du serveur
  }

  getInitialGameStarted(): boolean {
    return false
  }

  getInitialWaitingForGo(): boolean {
    return true
  }

  submitAnswer(answer: string): void {
    const { roomCode } = this.deps
    if (!roomCode) return

    const socket = getSocket()
    if (socket) {
      socket.emit('game:answer', {
        roomCode,
        answer: answer.trim(),
      })
    }
  }

  validateAnswers(_context: ValidateAnswersContext): void {
    // En mode online, le serveur valide les réponses et envoie game:answers-validated
    // Rien à faire côté client
  }

  leaveRoom(): void {
    const { roomCode } = this.deps
    if (!roomCode) return

    const socket = getSocket()
    if (socket?.connected) {
      socket.emit('room:leave', { roomCode })
    }
  }

  getPlayerId(): string {
    return getPlayerId() ?? ''
  }

  getDisplayScore(_score: number, gamePlayers: Player[]): number {
    const id = getPlayerId()
    return gamePlayers.find((p) => p.id === id)?.score ?? 0
  }
}
