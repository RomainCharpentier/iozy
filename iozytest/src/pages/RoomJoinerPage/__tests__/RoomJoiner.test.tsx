/**
 * Lobby invité : un invité devenu hôte (l'hôte a quitté le salon) peut lancer la partie
 * avec les réglages du salon ; les autres invités attendent toujours.
 */
import { vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import type { RoomSettings } from '@/hooks/useRoomSocket'

const { toastError, fakeSocket, hookState, getQuestionsForCategories } = vi.hoisted(() => ({
  toastError: vi.fn(),
  getQuestionsForCategories: vi.fn(),
  fakeSocket: { connected: true, emit: vi.fn() },
  hookState: {
    isHost: true,
    settings: null as RoomSettings | null,
    onError: null as null | ((code: string, message: string) => void),
  },
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: toastError }),
}))

vi.mock('@/utils/sounds', () => ({
  soundManager: { playClick: vi.fn(), playStart: vi.fn(), playSuccess: vi.fn() },
}))

vi.mock('@/utils/socket', () => ({
  getSocket: () => fakeSocket,
}))

vi.mock('@/services/questionService', () => ({
  QuestionService: {
    getQuestionsForCategories,
    buildQuestionPool: (q: unknown[]) => q,
    applyDefaultTimeLimit: (q: object[], timeLimit: number) => q.map((x) => ({ ...x, timeLimit })),
  },
}))

vi.mock('@/hooks/useRoomSocket', () => ({
  useRoomSocketJoin: (params: { onError: (code: string, message: string) => void }) => {
    hookState.onError = params.onError
    return {
      players: [{ id: 'me', name: 'Invité', score: 0, isHost: hookState.isHost, connected: true }],
      isHost: hookState.isHost,
      settings: hookState.settings,
      gameStarted: false,
      leaveRoom: vi.fn(),
    }
  },
}))

import RoomJoiner from '@/pages/RoomJoinerPage/RoomJoiner'

function renderJoiner() {
  return render(
    <RoomJoiner roomCode="ABC123" playerName="Invité" onJoined={vi.fn()} onBack={vi.fn()} />
  )
}

beforeEach(() => {
  toastError.mockClear()
  fakeSocket.emit.mockClear()
  hookState.isHost = true
  hookState.settings = { categories: ['anime'], defaultTimeLimit: 15 }
  getQuestionsForCategories.mockResolvedValue([{ id: 'q1', answer: 'A' }])
})

describe('RoomJoiner', () => {
  it('un invité devenu hôte lance la partie avec les réglages du salon', async () => {
    renderJoiner()
    expect(screen.getByText("Vous êtes maintenant l'hôte.")).toBeTruthy()
    expect(screen.queryByText("En attente que l'hôte démarre la partie…")).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Démarrer la partie/ }))
    })

    expect(getQuestionsForCategories).toHaveBeenCalledWith(['anime'])
    expect(fakeSocket.emit).toHaveBeenCalledWith('game:start', {
      roomCode: 'ABC123',
      questions: [{ id: 'q1', answer: 'A', timeLimit: 15 }],
      defaultTimeLimit: 15,
      questionCount: 20,
    })
    expect((screen.getByRole('button', { name: /Démarrage…/ }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })

  it('rend le bouton après une erreur du serveur', async () => {
    renderJoiner()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Démarrer la partie/ }))
    })

    act(() => {
      hookState.onError?.('NO_QUESTIONS', 'Aucune question disponible')
    })

    expect(toastError).toHaveBeenCalledWith('Erreur : Aucune question disponible')
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /Démarrer la partie/ }) as HTMLButtonElement).disabled
      ).toBe(false)
    )
  })

  it('rend le bouton quand le serveur ne répond pas', async () => {
    vi.useFakeTimers()
    try {
      renderJoiner()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Démarrer la partie/ }))
      })
      expect(screen.getByRole('button', { name: /Démarrage…/ })).toBeTruthy()

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(toastError).toHaveBeenCalledWith('Le serveur ne répond pas. Veuillez réessayer.')
      expect(
        (screen.getByRole('button', { name: /Démarrer la partie/ }) as HTMLButtonElement).disabled
      ).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it("un invité qui n'est pas hôte attend, sans bouton de lancement", () => {
    hookState.isHost = false
    renderJoiner()
    expect(screen.getByText("En attente que l'hôte démarre la partie…")).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Démarrer la partie/ })).toBeNull()
  })
})
