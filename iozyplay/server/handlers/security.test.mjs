import { test, describe } from 'node:test'
import assert from 'node:assert'
import { setupGameHandlers } from './gameHandlers.js'
import { setupRoomHandlers } from './roomHandlers.js'
import { createRoom, addPlayer, getRoomState } from '../domain/room.js'
import { roomRepository } from '../infrastructure/roomRepository.js'

function createMockSocket(socketId) {
  const events = {}
  const emitted = []
  return {
    id: socketId,
    on(event, handler) {
      events[event] = handler
    },
    off() {},
    emit(event, data) {
      emitted.push({ event, data })
    },
    join() {},
    leave() {},
    connected: true,
    _trigger(event, data) {
      if (events[event]) events[event](data)
    },
    _getEmitted() {
      return emitted
    }
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
    _getRoomEvents(roomCode) {
      return rooms[roomCode] || []
    }
  }
}

// Recherche récursive d'une clé dans un payload (après sérialisation JSON, comme Socket.IO)
function hasKey(value, key) {
  const json = JSON.parse(JSON.stringify(value ?? null))
  const visit = (v) => {
    if (Array.isArray(v)) return v.some(visit)
    if (v && typeof v === 'object') {
      return Object.keys(v).some(k => k === key || visit(v[k]))
    }
    return false
  }
  return visit(json)
}

const ROOM = 'SEC123'
const QUESTIONS = [
  { id: 'q1', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/a', answer: 'Song 1', hint: 'Années 80', timeLimit: 5 },
  { id: 'q2', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/b', answer: 'Song 2', timeLimit: 5 }
]

describe('Sécurité - aucune fuite de réponse avant le reveal', () => {
  let io, host, p1, p2

  test.beforeEach(() => {
    io = createMockIO()
    host = createMockSocket('socket-host')
    p1 = createMockSocket('socket-p1')
    p2 = createMockSocket('socket-p2')
    const room = createRoom(ROOM, 'host-id', 'socket-host', 'Host', ['pop'], 5)
    addPlayer(room, 'p1-id', 'socket-p1', 'P1')
    addPlayer(room, 'p2-id', 'socket-p2', 'P2')
    roomRepository.create(room)
    for (const s of [host, p1, p2]) setupGameHandlers(s, io)
  })

  test.afterEach(() => {
    roomRepository.delete(ROOM)
  })

  const allEvents = () => [
    ...io._getRoomEvents(ROOM),
    ...host._getEmitted(),
    ...p1._getEmitted(),
    ...p2._getEmitted()
  ]

  function startAndAnswer() {
    host._trigger('game:start', { roomCode: ROOM, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5 })
    for (const s of [host, p1, p2]) s._trigger('game:ready', { roomCode: ROOM })
    p1._trigger('game:answer', { roomCode: ROOM, answer: 'Song 1' })
    p2._trigger('game:answer', { roomCode: ROOM, answer: 'mauvaise' })
    // Late joiner / resync pendant la devinette
    p2._trigger('game:get-state', { roomCode: ROOM })
  }

  test('game:start, game:go, room:state et resync ne contiennent ni answer, ni socketId, ni sessionToken', () => {
    startAndAnswer()
    const events = allEvents()
    assert.ok(events.some(e => e.event === 'game:start'))
    for (const e of events) {
      assert.strictEqual(hasKey(e.data, 'answer'), false, `answer présent dans ${e.event}`)
      assert.strictEqual(hasKey(e.data, 'correctAnswer'), false, `correctAnswer présent dans ${e.event}`)
      assert.strictEqual(hasKey(e.data, 'socketId'), false, `socketId présent dans ${e.event}`)
      assert.strictEqual(hasKey(e.data, 'sessionToken'), false, `sessionToken présent dans ${e.event}`)
    }
    // L'indice est conservé (conçu pour être affiché)
    const start = events.find(e => e.event === 'game:start')
    assert.strictEqual(start.data.currentQuestion.hint, 'Années 80')
  })

  test('room:state expose qui a répondu, pas les réponses', () => {
    startAndAnswer()
    const state = getRoomState(roomRepository.get(ROOM))
    assert.strictEqual(state.game.answers, undefined)
    assert.deepStrictEqual([...state.game.answeredPlayers].sort(), ['p1-id', 'p2-id'])
    assert.strictEqual(hasKey(state, 'answer'), false)
    assert.strictEqual(state.game.correctAnswer, undefined)
  })

  test('la bonne réponse arrive dans game:answers-validated et game:reveal, puis game:next ne fuit pas la suivante', () => {
    startAndAnswer()
    // Tous votent skip pendant la devinette -> validation + reveal
    for (const s of [host, p1, p2]) s._trigger('game:skip-vote', { roomCode: ROOM })

    const events = io._getRoomEvents(ROOM)
    const validated = events.find(e => e.event === 'game:answers-validated')
    const reveal = events.find(e => e.event === 'game:reveal')
    assert.ok(validated && reveal)
    assert.strictEqual(validated.data.correctAnswer, 'Song 1')
    assert.strictEqual(validated.data.questionIndex, 0)
    assert.strictEqual(reveal.data.correctAnswer, 'Song 1')
    assert.strictEqual(reveal.data.questionIndex, 0)
    assert.deepStrictEqual(validated.data.correctPlayers, ['p1-id'])
    assert.strictEqual(hasKey(validated.data.players, 'socketId'), false)

    // Pendant le reveal, room:state peut donner la réponse (reconnexion)
    assert.strictEqual(getRoomState(roomRepository.get(ROOM)).game.correctAnswer, 'Song 1')

    // Tous votent skip pendant le reveal -> question suivante
    for (const s of [host, p1, p2]) s._trigger('game:skip-vote', { roomCode: ROOM })
    const next = io._getRoomEvents(ROOM).find(e => e.event === 'game:next')
    assert.ok(next)
    assert.strictEqual(next.data.questionIndex, 1)
    assert.strictEqual(hasKey(next.data, 'answer'), false)
    const stateAfterNext = getRoomState(roomRepository.get(ROOM))
    assert.strictEqual(hasKey(stateAfterNext, 'answer'), false)
    assert.strictEqual(stateAfterNext.game.correctAnswer, undefined)
  })
})

describe('Sécurité - jeton de session (usurpation)', () => {
  let io, hostSocket, roomCode, hostToken

  test.beforeEach(() => {
    io = createMockIO()
    hostSocket = createMockSocket('socket-host')
    setupRoomHandlers(hostSocket, io)
    hostSocket._trigger('room:create', { playerId: 'host-id', playerName: 'Host', categories: ['pop'] })
    const created = hostSocket._getEmitted().find(e => e.event === 'room:created')
    roomCode = created.data.roomCode
    hostToken = created.data.sessionToken
  })

  test.afterEach(() => {
    roomRepository.delete(roomCode)
  })

  test('room:created renvoie un sessionToken uniquement au créateur', () => {
    assert.strictEqual(typeof hostToken, 'string')
    assert.ok(hostToken.length >= 32)
    for (const e of io._getRoomEvents(roomCode)) {
      assert.strictEqual(hasKey(e.data, 'sessionToken'), false)
      assert.strictEqual(hasKey(e.data, 'socketId'), false)
    }
  })

  test('room:rejoin avec le playerId de l\'hôte sans jeton ou avec un mauvais jeton est refusé', () => {
    for (const token of [undefined, 'faux-jeton', '']) {
      const attacker = createMockSocket('socket-attacker')
      setupRoomHandlers(attacker, io)
      attacker._trigger('room:rejoin', { roomCode, playerId: 'host-id', sessionToken: token })
      const emitted = attacker._getEmitted()
      assert.ok(emitted.some(e => e.event === 'error' && e.data.code === 'INVALID_SESSION'))
      assert.strictEqual(emitted.some(e => e.event === 'room:rejoined'), false)
    }
    const host = roomRepository.get(roomCode).players.find(p => p.id === 'host-id')
    assert.strictEqual(host.socketId, 'socket-host')
  })

  test('room:join avec le playerId d\'un joueur existant sans jeton est refusé', () => {
    const attacker = createMockSocket('socket-attacker')
    setupRoomHandlers(attacker, io)
    attacker._trigger('room:join', { roomCode, playerId: 'host-id', playerName: 'Pirate' })
    const emitted = attacker._getEmitted()
    assert.ok(emitted.some(e => e.event === 'error' && e.data.code === 'INVALID_SESSION'))
    assert.strictEqual(emitted.some(e => e.event === 'room:joined'), false)
    const host = roomRepository.get(roomCode).players.find(p => p.id === 'host-id')
    assert.strictEqual(host.socketId, 'socket-host')
    assert.strictEqual(host.name, 'Host')
  })

  test('room:rejoin avec le bon jeton est accepté', () => {
    const newHostSocket = createMockSocket('socket-host-2')
    setupRoomHandlers(newHostSocket, io)
    newHostSocket._trigger('room:rejoin', { roomCode, playerId: 'host-id', sessionToken: hostToken })
    assert.ok(newHostSocket._getEmitted().some(e => e.event === 'room:rejoined'))
    const host = roomRepository.get(roomCode).players.find(p => p.id === 'host-id')
    assert.strictEqual(host.socketId, 'socket-host-2')
  })

  test('un nouveau joueur reçoit son propre jeton, qui ne vaut pas pour l\'hôte', () => {
    const player = createMockSocket('socket-p1')
    setupRoomHandlers(player, io)
    player._trigger('room:join', { roomCode, playerId: 'p1-id', playerName: 'P1' })
    const joined = player._getEmitted().find(e => e.event === 'room:joined')
    assert.ok(joined)
    const playerToken = joined.data.sessionToken
    assert.strictEqual(typeof playerToken, 'string')
    assert.notStrictEqual(playerToken, hostToken)

    player._trigger('room:rejoin', { roomCode, playerId: 'host-id', sessionToken: playerToken })
    assert.ok(player._getEmitted().some(e => e.event === 'error' && e.data.code === 'INVALID_SESSION'))

    // Le joueur peut se reconnecter avec son propre jeton via room:join
    const p1Again = createMockSocket('socket-p1-bis')
    setupRoomHandlers(p1Again, io)
    p1Again._trigger('room:join', { roomCode, playerId: 'p1-id', playerName: 'P1', sessionToken: playerToken })
    assert.ok(p1Again._getEmitted().some(e => e.event === 'room:joined'))
  })
})
