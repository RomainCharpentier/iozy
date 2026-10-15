import { test, describe } from 'node:test'
import assert from 'node:assert'
import { setupGameHandlers } from './gameHandlers.js'
import { setupRoomHandlers } from './roomHandlers.js'
import { normalizeTimeLimit, safeTimerCallback, TIME_LIMIT } from './validation.js'
import { createRoom, addPlayer } from '../domain/room.js'
import { storeAnswer, validateAnswers, startGame } from '../domain/game.js'
import { normalizeAnswer, compareAnswers } from '../domain/answerUtils.js'
import { roomRepository } from '../infrastructure/roomRepository.js'

function createMockSocket(socketId) {
  const events = {}
  const emitted = []
  return {
    id: socketId,
    on(event, handler) { events[event] = handler },
    off() {},
    emit(event, data) { emitted.push({ event, data }) },
    join() {},
    leave() {},
    connected: true,
    // Retourne la valeur du handler (promesse pour les handlers async)
    _trigger(event, ...args) { return events[event]?.(...args) },
    _events() { return Object.keys(events) },
    _getEmitted() { return emitted }
  }
}

function createMockIO() {
  const rooms = {}
  return {
    to(roomCode) {
      return {
        emit(event, data) {
          if (!rooms[roomCode]) rooms[roomCode] = []
          rooms[roomCode].push({ event, data })
        }
      }
    },
    _getRoomEvents(roomCode) { return rooms[roomCode] || [] }
  }
}

function invalidPayloadErrors(socket) {
  return socket._getEmitted().filter(e => e.event === 'error' && e.data.code === 'INVALID_PAYLOAD')
}

const ROOM = 'VALID1'

describe('answerUtils - réponses non-string', () => {
  test('normalizeAnswer renvoie une chaîne vide pour les non-string', () => {
    for (const value of [42, 0, {}, [], null, undefined, true, { trim: 1 }]) {
      assert.strictEqual(normalizeAnswer(value), '')
    }
  })

  test('compareAnswers renvoie false pour les non-string', () => {
    assert.strictEqual(compareAnswers(42, 'Song'), false)
    assert.strictEqual(compareAnswers({}, 'Song'), false)
    assert.strictEqual(compareAnswers(null, 'Song'), false)
    assert.strictEqual(compareAnswers('Song', undefined), false)
    assert.strictEqual(compareAnswers(null, null), false)
    assert.strictEqual(compareAnswers('Song', 'song'), true)
  })

  test('validateAnswers ne plante pas avec une réponse non-string stockée', () => {
    const room = createRoom(ROOM, 'host-id', 'socket-host', 'Host', [], 5)
    addPlayer(room, 'p1', 'socket-p1', 'P1')
    startGame(room, [{ id: 'q1', answer: 'Song 1' }], 5)
    storeAnswer(room, 'socket-host', { evil: true })
    storeAnswer(room, 'socket-p1', 12345)
    const result = validateAnswers(room)
    assert.strictEqual(result.validated, true)
    assert.strictEqual(result.validatedAnswers['host-id'], false)
    assert.strictEqual(result.validatedAnswers.p1, false)
  })
})

describe('normalizeTimeLimit', () => {
  test('valeurs invalides → défaut', () => {
    for (const value of [undefined, null, NaN, Infinity, '10', {}, []]) {
      assert.strictEqual(normalizeTimeLimit(value), TIME_LIMIT.DEFAULT)
    }
  })

  test('valeurs hors bornes → bornées', () => {
    assert.strictEqual(normalizeTimeLimit(0), TIME_LIMIT.MIN)
    assert.strictEqual(normalizeTimeLimit(-10), TIME_LIMIT.MIN)
    assert.strictEqual(normalizeTimeLimit(10_000), TIME_LIMIT.MAX)
    assert.strictEqual(normalizeTimeLimit(15), 15)
  })
})

describe('safeTimerCallback', () => {
  test('intercepte les exceptions du callback', () => {
    const originalError = console.error
    console.error = () => {}
    try {
      assert.doesNotThrow(safeTimerCallback('test', () => { throw new Error('boom') }))
    } finally {
      console.error = originalError
    }
  })
})

describe('Handlers - payloads invalides', () => {
  let io
  let hostSocket
  let playerSocket

  test.beforeEach(() => {
    roomRepository.delete(ROOM)
    io = createMockIO()
    hostSocket = createMockSocket('socket-host')
    playerSocket = createMockSocket('socket-p1')
    const room = createRoom(ROOM, 'host-id', 'socket-host', 'Host', ['pop'], 5)
    addPlayer(room, 'p1', 'socket-p1', 'P1')
    roomRepository.create(room)
    for (const socket of [hostSocket, playerSocket]) {
      setupRoomHandlers(socket, io)
      setupGameHandlers(socket, io)
    }
  })

  test.afterEach(() => {
    roomRepository.delete(ROOM)
  })

  test('payload absent ou null sur chaque handler → INVALID_PAYLOAD sans exception', async () => {
    const events = hostSocket._events().filter(e => e !== 'disconnect')
    assert.ok(events.includes('room:create'))
    assert.ok(events.includes('game:answer'))
    for (const event of events) {
      for (const payload of [undefined, null, 'str', 42, []]) {
        const before = invalidPayloadErrors(hostSocket).length
        await assert.doesNotReject(async () => hostSocket._trigger(event, payload))
        assert.strictEqual(invalidPayloadErrors(hostSocket).length, before + 1, `${event} / ${JSON.stringify(payload)}`)
      }
    }
  })

  test('roomCode non-string → INVALID_PAYLOAD', () => {
    hostSocket._trigger('game:ready', { roomCode: { $gt: '' } })
    hostSocket._trigger('room:leave', { roomCode: 123 })
    assert.strictEqual(invalidPayloadErrors(hostSocket).length, 2)
  })

  test('nom de joueur invalide → INVALID_PAYLOAD, nom trop long tronqué', async () => {
    hostSocket._trigger('update-player-name', { roomCode: ROOM, playerName: { a: 1 } })
    hostSocket._trigger('update-player-name', { roomCode: ROOM, playerName: '   ' })
    assert.strictEqual(invalidPayloadErrors(hostSocket).length, 2)

    hostSocket._trigger('update-player-name', { roomCode: ROOM, playerName: 'x'.repeat(500) })
    const host = roomRepository.get(ROOM).players.find(p => p.id === 'host-id')
    assert.strictEqual(host.name.length, 30)

    const socket = createMockSocket('socket-new')
    setupRoomHandlers(socket, io)
    await socket._trigger('room:join', { roomCode: ROOM, playerId: 'new-id', playerName: 42 })
    assert.strictEqual(invalidPayloadErrors(socket).length, 1)
  })

  test('game:answer non-string → INVALID_PAYLOAD, pas de réponse stockée', async () => {
    await hostSocket._trigger('game:start', { roomCode: ROOM, questions: [{ id: 'q1', answer: 'Song' }], defaultTimeLimit: 5 })
    for (const answer of [42, { a: 1 }, null, undefined, ['Song']]) {
      playerSocket._trigger('game:answer', { roomCode: ROOM, answer })
    }
    assert.strictEqual(invalidPayloadErrors(playerSocket).length, 5)
    assert.deepStrictEqual(roomRepository.get(ROOM).game.answers, {})

    // Une réponse string valide est toujours acceptée
    playerSocket._trigger('game:answer', { roomCode: ROOM, answer: 'Song' })
    assert.strictEqual(roomRepository.get(ROOM).game.answers.p1, 'Song')
  })

  test('game:start avec defaultTimeLimit invalide → durée bornée', async () => {
    const cases = [
      [0, TIME_LIMIT.MIN],
      [-5, TIME_LIMIT.MIN],
      [NaN, 5],
      ['abc', 5],
      [99999, TIME_LIMIT.MAX],
      [10, 10]
    ]
    for (const [defaultTimeLimit, expected] of cases) {
      await hostSocket._trigger('game:start', { roomCode: ROOM, questions: [{ id: 'q1', answer: 'Song' }], defaultTimeLimit })
      const room = roomRepository.get(ROOM)
      assert.strictEqual(room.defaultTimeLimit, expected, `defaultTimeLimit=${defaultTimeLimit}`)
      assert.strictEqual(room.game.durationMs, expected * 1000)
    }
  })

  test('game:start avec questions invalides', async () => {
    await hostSocket._trigger('game:start', { roomCode: ROOM, questions: 'pas un tableau' })
    await hostSocket._trigger('game:start', { roomCode: ROOM, questions: [1, 2, 3] })
    assert.strictEqual(invalidPayloadErrors(hostSocket).length, 2)

    await hostSocket._trigger('game:start', { roomCode: ROOM, questions: [] })
    const noQuestions = hostSocket._getEmitted().filter(e => e.event === 'error' && e.data.code === 'NO_QUESTIONS')
    assert.strictEqual(noQuestions.length, 1)
    assert.strictEqual(roomRepository.get(ROOM).gameState, 'waiting')
  })

  test('room:create borne defaultTimeLimit', async () => {
    const socket = createMockSocket('socket-creator')
    setupRoomHandlers(socket, io)
    await socket._trigger('room:create', { playerId: 'creator', playerName: 'C', defaultTimeLimit: -1 })
    const created = socket._getEmitted().find(e => e.event === 'room:created')
    assert.ok(created)
    const room = roomRepository.get(created.data.roomCode)
    assert.strictEqual(room.defaultTimeLimit, TIME_LIMIT.MIN)
    roomRepository.delete(created.data.roomCode)
  })
})
