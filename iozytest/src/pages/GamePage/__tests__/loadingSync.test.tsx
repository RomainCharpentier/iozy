/**
 * Écran de chargement en ligne (avant le « go ») : il dit qui la salle attend, et une
 * reconnexion pendant le chargement renvoie game:ready (sinon la salle attend sans fin).
 */
import { vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { Player } from '@/lib/game/types'
import type { Question } from '@/types'

const { fakeSocket, mediaProps, soundSpies } = vi.hoisted(() => {
  const handlers = new Map<string, Set<(...args: any[]) => void>>()
  const fakeSocket = {
    connected: true,
    emitted: [] as Array<{ event: string; payload: any }>,
    on(event: string, handler: (...args: any[]) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(handler)
      return fakeSocket
    },
    once(event: string, handler: (...args: any[]) => void) {
      const wrapped = (...args: any[]) => {
        fakeSocket.off(event, wrapped)
        handler(...args)
      }
      return fakeSocket.on(event, wrapped)
    },
    off(event: string, handler: (...args: any[]) => void) {
      handlers.get(event)?.delete(handler)
      return fakeSocket
    },
    emit(event: string, payload?: any) {
      fakeSocket.emitted.push({ event, payload })
      return fakeSocket
    },
    /** Événement envoyé par le serveur */
    serverEmit(event: string, payload?: any) {
      for (const handler of [...(handlers.get(event) ?? [])]) handler(payload)
    },
    reset() {
      handlers.clear()
      fakeSocket.connected = true
      fakeSocket.emitted = []
    },
  }
  return {
    fakeSocket,
    mediaProps: { current: null as any },
    soundSpies: {} as Record<string, ReturnType<typeof vi.fn>>,
  }
})

vi.mock('@/utils/socket', () => ({
  connectSocket: () => fakeSocket,
  getSocket: () => fakeSocket,
  setCurrentRoom: () => {},
  clearCurrentRoom: () => {},
  disconnectSocketIfConnected: () => {},
}))

// Lecteur factice : le test déclenche lui-même onMediaReady / onMediaStart
vi.mock('@/components/media/MediaPlayer', () => ({
  default: (props: any) => {
    mediaProps.current = props
    return <div data-testid="media-player" />
  },
}))

vi.mock('@/services/categoryService', () => ({
  loadCategories: () => Promise.resolve([]),
}))

vi.mock('@/pages/GamePage/question/useAnswerSuggestions', () => ({
  useAnswerSuggestions: () => SUGGESTIONS,
}))

vi.mock('@/utils/sounds', () => ({
  // Chaque son est un espion (vi.fn), créé à la première utilisation
  soundManager: new Proxy({}, { get: (_target, name: string) => (soundSpies[name] ??= vi.fn()) }),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/utils/playerId', () => ({
  getPlayerId: () => 'me',
}))

import Game from '@/pages/GamePage/Game'

const SUGGESTIONS = ['Naruto', 'Nana', 'Bleach']
const ROOM = 'ABC123'
const DURATION_MS = 20000

const questions: Question[] = [
  {
    id: 'q1',
    category: 'animes',
    type: 'audio',
    mediaUrl: 'https://example.com/q1.mp3',
    answer: 'Naruto',
    timeLimit: 20,
  } as Question,
  {
    id: 'q2',
    category: 'animes',
    type: 'audio',
    mediaUrl: 'https://example.com/q2.mp3',
    answer: 'Bleach',
    timeLimit: 20,
  } as Question,
]
// Questions telles que le serveur les envoie : sans réponse
const publicQuestions = questions.map(({ answer: _answer, ...q }) => q)

const players: Player[] = [
  { id: 'me', name: 'Moi', score: 0, isHost: true, connected: true },
  { id: 'other', name: 'Autre', score: 0, connected: true },
]

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const server = (event: string, payload?: any) =>
  act(() => {
    fakeSocket.serverEmit(event, payload)
  })

beforeEach(() => {
  vi.useFakeTimers()
  fakeSocket.reset()
  mediaProps.current = null
  globalThis.localStorage?.clear?.()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Partie en ligne : question 1 annoncée, en attente du « go » */
function startLoading() {
  render(
    <Game
      questions={[]}
      categories={['animes']}
      gameMode="online"
      players={players}
      roomCode={ROOM}
      onEndGame={() => {}}
    />
  )
  server('room:rejoined')
  server('game:start', { questions: publicQuestions, questionIndex: 0, players })
}

/** Le lecteur signale le média prêt (QuestionCard 100 ms, puis Game 500 ms) */
function mediaReady() {
  act(() => {
    mediaProps.current.onMediaReady()
  })
  advance(700)
}

const readyEmits = () => fakeSocket.emitted.filter((e) => e.event === 'game:ready').length

describe('Chargement en ligne : qui la salle attend', () => {
  it('affiche le nombre de joueurs prêts et le nom de ceux qu’on attend', () => {
    startLoading()
    mediaReady()
    server('room:state', {
      phase: 'playing',
      players: [...players, { id: 'gone', name: 'Parti', score: 0, connected: false }],
      questions: publicQuestions,
      game: { questionIndex: 0, step: 'loading', readyPlayers: ['me'] },
    })
    const intro = screen.getByTestId('question-intro')
    expect(intro.textContent).toContain('En attente des autres joueurs… (1/2 prêts)')
    // Seuls les joueurs connectés comptent
    expect(screen.getByTestId('waiting-for').textContent).toBe('En attente de : Autre')
  })

  it('le joueur local compte prêt dès que son média l’est, sans attendre room:state', () => {
    startLoading()
    server('room:state', {
      phase: 'playing',
      players,
      questions: publicQuestions,
      game: { questionIndex: 0, step: 'loading', readyPlayers: ['other'] },
    })
    mediaReady()
    expect(screen.getByTestId('question-intro').textContent).toContain('(2/2 prêts)')
    expect(screen.queryByTestId('waiting-for')).toBeNull()
  })

  it('n’affiche pas la liste de la question précédente', () => {
    startLoading()
    server('room:state', {
      phase: 'playing',
      players,
      questions: publicQuestions,
      game: { questionIndex: 0, step: 'loading', readyPlayers: ['other'] },
    })
    server('game:next', { questions: publicQuestions, questionIndex: 1 })
    // Média de la question 2 prêt avant le prochain room:state : liste de la question 1 périmée
    mediaReady()
    const intro = screen.getByTestId('question-intro')
    expect(intro.textContent).toContain('En attente des autres joueurs…')
    expect(intro.textContent).not.toContain('prêts')
    expect(screen.queryByTestId('waiting-for')).toBeNull()
  })
})

describe('Chargement en ligne : reconnexion', () => {
  it('média prêt pendant une coupure : game:ready est renvoyé à la reconnexion', () => {
    startLoading()
    fakeSocket.connected = false
    mediaReady()
    expect(readyEmits()).toBe(0)

    // Séquence serveur de room:rejoin : room:rejoined, puis game:start sur la même question
    fakeSocket.connected = true
    server('room:rejoined')
    server('game:start', { questions: publicQuestions, questionIndex: 0, players })
    expect(readyEmits()).toBeGreaterThan(0)
    expect(fakeSocket.emitted.at(-1)).toEqual({ event: 'game:ready', payload: { roomCode: ROOM } })

    // Le « go » lance bien l'extrait (le média n'est pas rechargé)
    server('game:go', { durationMs: DURATION_MS })
    expect(screen.queryByTestId('question-intro')).toBeNull()
  })

  it('reconnexion avant que le média soit prêt : rien n’est renvoyé', () => {
    startLoading()
    server('room:rejoined')
    server('game:start', { questions: publicQuestions, questionIndex: 0, players })
    expect(readyEmits()).toBe(0)
  })

  it('reconnexion après le « go » : pas de nouveau game:ready', () => {
    startLoading()
    mediaReady()
    server('game:go', { durationMs: DURATION_MS })
    act(() => {
      mediaProps.current.onMediaStart()
    })
    const before = readyEmits()
    server('room:rejoined')
    server('game:start', { questions: publicQuestions, questionIndex: 0, players })
    expect(readyEmits()).toBe(before)
  })
})
