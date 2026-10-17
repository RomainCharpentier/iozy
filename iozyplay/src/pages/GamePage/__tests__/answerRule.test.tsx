/**
 * Règle métier de la réponse (solo ET en ligne), testée sur le composant Game complet :
 * - une seule réponse par question, modifiable pendant tout le guess (même après envoi,
 *   même après choix d'une suggestion) ;
 * - le contenu du champ compte, sans Entrée (envoi automatique) ;
 * - la saisie en attente part avant le vote « Passer » ;
 * - champ figé au reveal (y compris après room:state / reconnexion) ;
 * - aucun retour juste/faux avant le reveal.
 */
import { vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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
import { AUTO_SEND_DELAY_MS } from '@/pages/GamePage/question/useAnswerAutoSend'

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

const input = () => screen.getByRole('combobox', { name: 'Votre réponse' }) as HTMLInputElement
const skipButton = () => screen.getByTestId('skip-button') as HTMLButtonElement
const answersSent = () =>
  fakeSocket.emitted.filter((e) => e.event === 'game:answer').map((e) => e.payload.answer)
const emittedEvents = () => fakeSocket.emitted.map((e) => e.event)

const type = (value: string) => fireEvent.change(input(), { target: { value } })
const pressEnter = () => fireEvent.keyDown(input(), { key: 'Enter' })
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })
const server = (event: string, payload?: any) =>
  act(() => {
    fakeSocket.serverEmit(event, payload)
  })

/** Aucun retour juste/faux visible ni annoncé */
const expectNoCorrectnessFeedback = () => {
  const text = document.body.textContent ?? ''
  expect(text).not.toMatch(
    /Correct !|Incorrect|incorrecte|est correcte|Bonne réponse|bonne réponse|Bien joué|Raté/
  )
  expect(screen.queryByTestId('reveal-result')).toBeNull()
  expect(input().getAttribute('placeholder')).not.toBe('Pas de réponse')
}

beforeEach(() => {
  vi.useFakeTimers()
  fakeSocket.reset()
  mediaProps.current = null
  globalThis.localStorage?.clear?.()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Partie en ligne démarrée sur la question 1, chrono lancé */
function startOnlineGame() {
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
  server('game:go', { durationMs: DURATION_MS })
  act(() => {
    mediaProps.current.onMediaStart()
  })
  advance(150)
}

/** Fin du guess côté serveur : validation puis reveal */
function serverReveal(validated: Record<string, boolean>, answers: Record<string, string>) {
  server('game:answers-validated', {
    validatedAnswers: { ...validated, _validated: true },
    correctPlayers: Object.keys(validated).filter((id) => validated[id]),
    players,
    playerAnswers: answers,
    questionIndex: 0,
    correctAnswer: 'Naruto',
  })
  server('game:reveal', { questionIndex: 0, durationMs: DURATION_MS, correctAnswer: 'Naruto' })
}

describe('Réponse en ligne', () => {
  it('modifiable après envoi : Entrée envoie, le champ reste éditable et le renvoi remplace', () => {
    startOnlineGame()
    type('Bleach')
    pressEnter()
    expect(answersSent()).toEqual(['Bleach'])
    expect(input().readOnly).toBe(false)

    type('Naruto')
    pressEnter()
    expect(answersSent()).toEqual(['Bleach', 'Naruto'])
    expect(input().readOnly).toBe(false)
    expectNoCorrectnessFeedback()
  })

  it('saisie non revalidée : le contenu du champ part tout seul et c’est lui qui compte', () => {
    startOnlineGame()
    type('Bleach')
    pressEnter()
    type('Naruto') // pas d'Entrée
    expect(screen.getByTestId('answer-status-pending')).toBeTruthy()
    advance(AUTO_SEND_DELAY_MS)
    expect(answersSent()).toEqual(['Bleach', 'Naruto'])

    // Accusé du serveur : l'indicateur passe à « enregistrée »
    server('game:answer-stored', { playerId: 'me' })
    expect(screen.queryByTestId('answer-status-pending')).not.toBeNull()
    server('game:answer-stored', { playerId: 'me' })
    expect(screen.getByTestId('answer-status-saved')).toBeTruthy()
  })

  it('suggestion choisie à la souris ou au clavier : envoyée, puis toujours modifiable', () => {
    startOnlineGame()
    type('Na')
    fireEvent.click(screen.getByRole('option', { name: 'Nana' }))
    expect(input().value).toBe('Nana')
    expect(answersSent()).toEqual(['Nana'])
    expect(input().readOnly).toBe(false)

    type('Nar')
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(input().value).toBe('Naruto')
    expect(answersSent()).toEqual(['Nana', 'Naruto'])

    type('Naruto Shippuden')
    advance(AUTO_SEND_DELAY_MS)
    expect(answersSent()).toEqual(['Nana', 'Naruto', 'Naruto Shippuden'])
  })

  it('la saisie en attente part AVANT le vote « Passer » (double-clic : un seul vote)', () => {
    startOnlineGame()
    type('Naruto') // délai non écoulé
    fireEvent.click(skipButton())
    fireEvent.click(skipButton())
    const relevant = fakeSocket.emitted
      .map((e) => e.event)
      .filter((e) => e === 'game:answer' || e === 'game:skip-vote')
    expect(relevant).toEqual(['game:answer', 'game:skip-vote'])
    expect(answersSent()).toEqual(['Naruto'])

    // Après le vote, le guess continue : la réponse reste modifiable
    expect(input().readOnly).toBe(false)
  })

  it('guess : un room:state diffusé ne remet pas le chrono à zéro ni la saisie', () => {
    startOnlineGame()
    type('Naruto')
    const before = screen.getByTestId('game-topbar').textContent
    expect(before).toContain('0:19')

    server('room:state', {
      phase: 'playing',
      players,
      questions: publicQuestions,
      game: { questionIndex: 0, step: 'playing', durationMs: DURATION_MS, timeRemainingMs: 19000 },
    })
    // Avant tout nouveau tick du chrono : rien n'a été réinitialisé
    expect(screen.getByTestId('game-topbar').textContent).toContain('0:19')
    expect(input().value).toBe('Naruto')
    expect(input().readOnly).toBe(false)
  })

  it('arrivée en plein reveal : le démarrage du média ne rouvre pas le champ', () => {
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
    // Séquence de game:get-state pour une question déjà validée
    server('room:joined', {})
    server('room:state', {
      phase: 'playing',
      players,
      questions: publicQuestions,
      game: {
        questionIndex: 0,
        step: 'playing',
        durationMs: DURATION_MS,
        validatedAnswers: { other: true, _validated: true },
        correctAnswer: 'Naruto',
      },
    })
    server('game:start', { questions: publicQuestions, questionIndex: 0, players })
    server('game:sync', {
      startedAt: 0,
      durationMs: DURATION_MS,
      timeRemainingMs: 0,
      serverTime: Date.now(),
      questionIndex: 0,
    })
    expect(input().readOnly).toBe(true)

    // Un lecteur audio qui démarre maintenant ne doit pas relancer un guess
    act(() => {
      mediaProps.current.onMediaStart()
    })
    advance(200)
    expect(input().readOnly).toBe(true)
    type('Naruto')
    expect(answersSent()).toEqual([])
  })

  it('média lent qui démarre après le reveal serveur : le champ reste figé', () => {
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
    server('game:go', { durationMs: DURATION_MS })
    type('Naruto')
    advance(AUTO_SEND_DELAY_MS)
    // Fin du guess côté serveur avant le premier PLAYING du lecteur local
    serverReveal({ me: true }, { me: 'Naruto' })
    expect(input().readOnly).toBe(true)

    act(() => {
      mediaProps.current.onMediaStart()
    })
    // Jamais rouvert, même brièvement (pas d'attente du prochain tick du chrono)
    expect(input().readOnly).toBe(true)
    advance(200)
    expect(input().readOnly).toBe(true)
    expect(input().value).toBe('Naruto')
  })

  it('champ vidé pendant le guess : la réponse est retirée (réponse vide envoyée)', () => {
    startOnlineGame()
    type('Naruto')
    pressEnter()
    type('')
    advance(AUTO_SEND_DELAY_MS)
    expect(answersSent()).toEqual(['Naruto', ''])
  })

  it('aucun retour juste/faux avant le reveal, puis champ figé au reveal', () => {
    startOnlineGame()
    type('Bleach')
    advance(AUTO_SEND_DELAY_MS)
    expectNoCorrectnessFeedback()

    serverReveal({ me: false }, { me: 'Bleach' })
    expect(input().readOnly).toBe(true)
    // Réponse fausse : bandeau « Raté ! » (pas un bandeau vert de réussite)
    const banner = screen.getByTestId('reveal-result')
    expect(banner.getAttribute('data-result')).toBe('incorrect')
    expect(banner.textContent).toContain('Raté !')
    expect(banner.textContent).toContain('Naruto')
    expect(banner.textContent).not.toContain('Bien joué')
    expect(screen.getByTestId('game-announcer').textContent).toContain(
      'Votre réponse est incorrecte.'
    )

    // Plus aucune modification ni envoi possible
    const sentBefore = answersSent().length
    type('Naruto')
    pressEnter()
    advance(AUTO_SEND_DELAY_MS)
    expect(input().value).toBe('Bleach')
    expect(answersSent()).toHaveLength(sentBefore)
  })

  it('reveal : un room:state diffusé (arrivée/départ d’un joueur) ne rouvre pas le champ', () => {
    startOnlineGame()
    serverReveal({}, {})
    expect(input().readOnly).toBe(true)

    server('room:state', {
      phase: 'playing',
      players: players.slice(0, 1),
      questions: publicQuestions,
      game: {
        questionIndex: 0,
        step: 'playing',
        durationMs: DURATION_MS,
        validatedAnswers: { _validated: true },
        correctAnswer: 'Naruto',
      },
    })
    advance(200)
    expect(input().readOnly).toBe(true)
  })

  it('reconnexion pendant le reveal (game:start + game:sync à 0) : le champ reste figé', () => {
    startOnlineGame()
    type('Bleach')
    advance(AUTO_SEND_DELAY_MS)
    serverReveal({ me: false }, { me: 'Bleach' })

    // Séquence serveur de room:rejoin : room:rejoined, room:state, game:start, game:sync
    server('room:rejoined')
    server('room:state', {
      phase: 'playing',
      players,
      questions: publicQuestions,
      game: {
        questionIndex: 0,
        step: 'playing',
        durationMs: DURATION_MS,
        validatedAnswers: { me: false, _validated: true },
        correctAnswer: 'Naruto',
      },
    })
    server('game:start', { questions: publicQuestions, questionIndex: 0, players })
    server('game:sync', {
      startedAt: 0,
      durationMs: DURATION_MS,
      timeRemainingMs: 0,
      serverTime: Date.now(),
      questionIndex: 0,
    })
    advance(200)
    expect(input().readOnly).toBe(true)
    expect(input().value).toBe('Bleach')
    expect(answersSent()).toEqual(['Bleach'])
  })

  it('reconnexion pendant le guess : saisie conservée, renvoyée, chrono réaligné', () => {
    startOnlineGame()
    type('Naruto')
    advance(AUTO_SEND_DELAY_MS)
    expect(answersSent()).toEqual(['Naruto'])

    server('disconnect')
    expect(screen.getByTestId('connection-lost')).toBeTruthy()

    server('room:rejoined')
    expect(answersSent()).toEqual(['Naruto', 'Naruto'])
    expect(screen.queryByTestId('connection-lost')).toBeNull()

    server('game:start', { questions: publicQuestions, questionIndex: 0, players })
    server('game:sync', {
      startedAt: 0,
      durationMs: DURATION_MS,
      timeRemainingMs: 8000,
      serverTime: Date.now(),
      questionIndex: 0,
    })
    advance(150)
    expect(input().value).toBe('Naruto')
    expect(input().readOnly).toBe(false)
    // Le chrono suit le serveur (~8 s, marge de sécurité incluse), pas la durée complète
    expect(screen.getByTestId('game-topbar').textContent).toMatch(/0:0[6-8]/)
  })

  it('transition entre questions : écran « Question N sur M » puis signal sonore', () => {
    startOnlineGame()
    serverReveal({}, {})
    server('game:next', { questions: publicQuestions, questionIndex: 1 })
    const intro = screen.getByTestId('question-intro')
    expect(intro.textContent).toContain('Question 2')
    expect(intro.textContent).toContain('sur 2')
    expect(intro.textContent).toContain('Animé')

    // Pendant la transition, l'extrait se charge mais ne joue pas
    expect(mediaProps.current.shouldPause).toBe(true)

    server('game:go', { durationMs: DURATION_MS })
    expect(screen.queryByTestId('question-intro')).toBeNull()
    soundSpies.playStart?.mockClear()
    act(() => {
      mediaProps.current.onMediaStart()
    })
    // Début du chrono : signal sonore (pas de message à l'écran)
    expect(soundSpies.playStart).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('À vous !')).toBeNull()
  })

  it('question suivante : la saisie en attente de la question précédente ne part pas', () => {
    startOnlineGame()
    serverReveal({}, {})
    server('game:next', { questions: publicQuestions, questionIndex: 1 })
    expect(input().value).toBe('')
    expect(input().readOnly).toBe(false)
    expect(emittedEvents().filter((e) => e === 'game:answer')).toHaveLength(0)
  })
})

describe('Réponse en solo', () => {
  function startSoloGame() {
    render(
      <Game
        questions={questions}
        categories={['animes']}
        gameMode="solo"
        players={[]}
        onEndGame={() => {}}
      />
    )
    act(() => {
      mediaProps.current.onMediaStart()
    })
    advance(150)
  }

  const scoreText = () => screen.getByTestId('game-topbar').textContent ?? ''

  it('une bonne réponse validée par Entrée ne déclenche pas de reveal anticipé', () => {
    startSoloGame()
    type('Naruto')
    pressEnter()
    expect(input().readOnly).toBe(false)
    expect(input().value).toBe('Naruto')
    expectNoCorrectnessFeedback()
    expect(scoreText()).toContain('Score0')
  })

  it('une mauvaise réponse n’est pas effacée et reste modifiable', () => {
    startSoloGame()
    type('Bleach')
    pressEnter()
    expect(input().value).toBe('Bleach')
    expect(input().readOnly).toBe(false)
    expectNoCorrectnessFeedback()
  })

  it('fin du chrono : la saisie non revalidée est celle retenue (et comparée au reveal)', () => {
    startSoloGame()
    type('Bleach')
    pressEnter()
    type('Naruto') // remplacée sans Entrée
    advance(DURATION_MS)
    expect(input().readOnly).toBe(true)
    expect(scoreText()).toContain('Score1')
    expect(screen.getByTestId('reveal-result').getAttribute('data-result')).toBe('correct')
    expect(screen.getByTestId('game-announcer').textContent).toContain(
      'Votre réponse est correcte.'
    )
  })

  it('une bonne réponse remplacée par une mauvaise ne rapporte rien', () => {
    startSoloGame()
    type('Naruto')
    pressEnter()
    type('Bleach')
    fireEvent.click(skipButton())
    expect(input().readOnly).toBe(true)
    expect(scoreText()).toContain('Score0')
    expect(screen.getByTestId('game-announcer').textContent).toContain(
      'Votre réponse est incorrecte.'
    )
  })

  it('suggestion choisie puis modifiée : c’est la dernière saisie qui compte', () => {
    startSoloGame()
    type('Bl')
    fireEvent.click(screen.getByRole('option', { name: 'Bleach' }))
    expect(input().value).toBe('Bleach')
    type('Naruto')
    fireEvent.click(skipButton())
    expect(scoreText()).toContain('Score1')
  })

  it('chaque partie solo tire un départ aléatoire par question, transmis au lecteur', () => {
    startSoloGame()
    const fraction = mediaProps.current.startFraction
    expect(typeof fraction).toBe('number')
    expect(fraction).toBeGreaterThanOrEqual(0)
    expect(fraction).toBeLessThan(1)
  })

  it('solo : transition entre questions, extrait chargé en pause puis lancé', () => {
    startSoloGame()
    fireEvent.click(skipButton()) // fin du guess → reveal
    advance(DURATION_MS) // fin du reveal
    const intro = screen.getByTestId('question-intro')
    expect(intro.textContent).toContain('Question 2')
    expect(intro.textContent).toContain('Préparez-vous')
    expect(mediaProps.current.shouldPause).toBe(true)
    expect(mediaProps.current.autoPlay).toBe(false)
    // « Passer » inactif pendant la transition
    expect(skipButton().disabled).toBe(true)

    advance(3000)
    expect(screen.queryByTestId('question-intro')).toBeNull()
    expect(mediaProps.current.autoPlay).toBe(true)
    expect(mediaProps.current.shouldPause).toBe(false)
    expect(input().readOnly).toBe(false)
  })

  it('champ vidé avant la fin : pas de réponse', () => {
    startSoloGame()
    type('Naruto')
    type('')
    fireEvent.click(skipButton())
    expect(scoreText()).toContain('Score0')
    expect(screen.getByTestId('reveal-result').getAttribute('data-result')).toBe('none')
    expect(screen.getByTestId('reveal-result').textContent).toContain('Pas de réponse')
    expect(screen.getByTestId('game-announcer').textContent).toContain('Vous n’avez pas répondu.')
  })
})
