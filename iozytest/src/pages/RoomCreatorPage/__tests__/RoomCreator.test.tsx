/**
 * Lobby de l'hôte : le bouton « Démarrer la partie » ne reste jamais bloqué sur « Démarrage… »,
 * et « Partager le lien » prévient quand le presse-papiers est indisponible.
 */
import { vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

const { toastError, fakeSocket, handlers, getQuestionsForCategories } = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  return {
    toastError: vi.fn(),
    handlers,
    getQuestionsForCategories: vi.fn(),
    fakeSocket: {
      connected: true,
      emit: vi.fn(),
      on: vi.fn((event: string, cb: (payload: unknown) => void) => {
        handlers[event] = cb
      }),
      off: vi.fn((event: string) => {
        delete handlers[event]
      }),
    },
  }
})

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: toastError }),
}))

vi.mock('@/utils/sounds', () => ({
  soundManager: { playClick: vi.fn(), playStart: vi.fn(), playSuccess: vi.fn() },
}))

vi.mock('@/utils/socket', () => ({
  getSocket: () => fakeSocket,
  disconnectSocketIfConnected: vi.fn(),
}))

vi.mock('@/services/categoryService', () => ({
  loadCategories: () => Promise.resolve([]),
}))

vi.mock('@/services/questionService', () => ({
  QuestionService: {
    getQuestionsForCategories,
    buildQuestionPool: (q: unknown[]) => q,
    applyDefaultTimeLimit: (q: unknown[]) => q,
    shuffleQuestions: (q: unknown[]) => q,
  },
}))

vi.mock('@/hooks/useRoomSocket', () => ({
  useRoomSocketCreate: () => ({
    roomCode: 'ABC123',
    players: [
      { id: 'me', name: 'Hôte', score: 0, isHost: true, connected: true },
      { id: 'other', name: 'Invité', score: 0, connected: true },
    ],
    shareLink: 'http://192.168.1.10/test/?room=ABC123',
    currentPlayerName: 'Hôte',
    isConnecting: false,
    error: null,
    leaveRoom: vi.fn(),
  }),
}))

import RoomCreator from '@/pages/RoomCreatorPage/RoomCreator'

const QUESTIONS = [{ id: 'q1', answer: 'A' }]

function renderCreator() {
  return render(
    <RoomCreator
      categories={['anime']}
      questions={[]}
      playerName="Hôte"
      onRoomCreated={vi.fn()}
      onBack={vi.fn()}
    />
  )
}

beforeEach(() => {
  toastError.mockClear()
  fakeSocket.emit.mockClear()
  fakeSocket.connected = true
  getQuestionsForCategories.mockResolvedValue(QUESTIONS)
})

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
})

describe('RoomCreator', () => {
  it('rend le bouton de démarrage après une erreur du serveur sur game:start', async () => {
    renderCreator()
    const start = await screen.findByRole('button', { name: /Démarrer la partie/ })
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false))

    await act(async () => {
      fireEvent.click(start)
    })
    await waitFor(() =>
      expect(fakeSocket.emit).toHaveBeenCalledWith('game:start', expect.anything())
    )
    expect((screen.getByRole('button', { name: /Démarrage…/ }) as HTMLButtonElement).disabled).toBe(
      true
    )

    act(() => {
      handlers.error({ code: 'NO_QUESTIONS', message: 'Aucune question disponible' })
    })

    expect(toastError).toHaveBeenCalledWith(
      'Erreur : Aucune question disponible',
      expect.anything()
    )
    expect(
      (screen.getByRole('button', { name: /Démarrer la partie/ }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('rend le bouton de démarrage quand aucune question ne charge', async () => {
    // Le compte affiché au chargement voit des questions, le chargement au clic n'en trouve plus
    getQuestionsForCategories.mockResolvedValueOnce(QUESTIONS).mockResolvedValue([])
    renderCreator()
    const start = await screen.findByRole('button', { name: /Démarrer la partie/ })
    await waitFor(() => expect((start as HTMLButtonElement).disabled).toBe(false))

    await act(async () => {
      fireEvent.click(start)
    })

    expect(fakeSocket.emit).not.toHaveBeenCalledWith('game:start', expect.anything())
    expect(
      (screen.getByRole('button', { name: /Démarrer la partie/ }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('prévient et sélectionne le lien quand le presse-papiers est indisponible', async () => {
    // http sur le réseau local : pas de navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    renderCreator()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Partager le lien' }))
    })

    expect(toastError).toHaveBeenCalledWith(
      "Copie impossible : sélectionne le lien d'invitation",
      expect.objectContaining({ description: 'http://192.168.1.10/test/?room=ABC123' })
    )
    expect(document.activeElement).toBe(screen.getByLabelText("Lien d'invitation"))
  })

  it('copie le lien quand le presse-papiers est disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderCreator()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Partager le lien' }))
    })

    expect(writeText).toHaveBeenCalledWith('http://192.168.1.10/test/?room=ABC123')
    expect(toastError).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Lien copié' })).toBeTruthy()
  })
})
