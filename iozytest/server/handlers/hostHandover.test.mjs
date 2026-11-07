import { test, describe } from 'node:test'
import assert from 'node:assert'
import { setupGameHandlers } from './gameHandlers.js'
import { setupRoomHandlers } from './roomHandlers.js'
import { createRoom, addPlayer } from '../domain/room.js'
import { QUESTION_TRANSITION_MS } from '../domain/game.js'
import { roomRepository } from '../infrastructure/roomRepository.js'

const CODE = 'HAND01'

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

const QUESTIONS = [
  { id: 'q1', answer: 'Song 1', timeLimit: 20 },
  { id: 'q2', answer: 'Song 2', timeLimit: 20 }
]

describe('Départ de l\'hôte, attente du chargement et votes avant le « go »', () => {
  let io
  let host
  let guest

  test.beforeEach(() => {
    roomRepository.delete(CODE)
    io = createMockIO()
    host = createMockSocket('socket-host')
    guest = createMockSocket('socket-guest')
    const room = createRoom(CODE, 'host-id', 'socket-host', 'Hôte', ['pop'], 20)
    addPlayer(room, 'guest-id', 'socket-guest', 'Invité')
    roomRepository.create(room)
    for (const socket of [host, guest]) {
      setupRoomHandlers(socket, io)
      setupGameHandlers(socket, io)
    }
  })

  test.afterEach(() => {
    roomRepository.delete(CODE)
  })

  const goEvents = () => io._getRoomEvents(CODE).filter(e => e.event === 'game:go')
  const lastState = () => io._getRoomEvents(CODE).filter(e => e.event === 'room:state').at(-1)?.data

  test('room:leave de l\'hôte dans le salon : l\'invité devient hôte et peut lancer la partie', () => {
    host._trigger('room:leave', { roomCode: CODE })

    const room = roomRepository.get(CODE)
    assert.strictEqual(room.hostPlayerId, 'guest-id')
    assert.strictEqual(room.players[0].isHost, true)
    assert.strictEqual(lastState().hostPlayerId, 'guest-id')

    guest._trigger('game:start', { roomCode: CODE, questions: QUESTIONS, defaultTimeLimit: 20 })
    assert.ok(!guest._getEmitted().some(e => e.event === 'error'))
    assert.strictEqual(roomRepository.get(CODE).gameState, 'playing')
  })

  test('room:leave de l\'hôte en pleine partie : l\'invité devient hôte', () => {
    host._trigger('game:start', { roomCode: CODE, questions: QUESTIONS, defaultTimeLimit: 20 })
    host._trigger('room:leave', { roomCode: CODE })

    const room = roomRepository.get(CODE)
    assert.strictEqual(room.hostPlayerId, 'guest-id')
    assert.strictEqual(room.players[0].isHost, true)
  })

  test('un joueur se déconnecte avant d\'être prêt : les autres reçoivent game:go', () => {
    host._trigger('game:start', { roomCode: CODE, questions: QUESTIONS, defaultTimeLimit: 20 })
    host._trigger('game:ready', { roomCode: CODE })
    assert.strictEqual(goEvents().length, 0)

    guest._trigger('disconnect', 'transport close')

    assert.strictEqual(goEvents().length, 1)
    assert.ok(roomRepository.get(CODE).game.startedAt)
  })

  test('un joueur quitte (room:leave) avant d\'être prêt : les autres reçoivent game:go', () => {
    host._trigger('game:start', { roomCode: CODE, questions: QUESTIONS, defaultTimeLimit: 20 })
    host._trigger('game:ready', { roomCode: CODE })
    guest._trigger('room:leave', { roomCode: CODE })

    assert.strictEqual(goEvents().length, 1)
  })

  test('vote skip et réponse avant le « go » : ignorés', () => {
    host._trigger('game:start', { roomCode: CODE, questions: QUESTIONS, defaultTimeLimit: 20 })
    host._trigger('game:answer', { roomCode: CODE, answer: 'Song 1' })
    host._trigger('game:skip-vote', { roomCode: CODE })
    guest._trigger('game:skip-vote', { roomCode: CODE })

    const room = roomRepository.get(CODE)
    assert.strictEqual(room.game.skipVotes.size, 0)
    assert.deepStrictEqual(Object.keys(room.game.answers), [])
    assert.ok(!host._getEmitted().some(e => e.event === 'game:answer-stored'))
    assert.ok(!io._getRoomEvents(CODE).some(e => e.event === 'game:skip-vote-updated'))
  })

  test('pendant la transition vers la question 2, un skip ne compte pas la question deux fois', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() })
    const bothReady = () => {
      host._trigger('game:ready', { roomCode: CODE })
      guest._trigger('game:ready', { roomCode: CODE })
    }

    host._trigger('game:start', { roomCode: CODE, questions: QUESTIONS, defaultTimeLimit: 20 })
    bothReady()
    host._trigger('game:next', { roomCode: CODE })
    bothReady() // « go » prévu à la fin de la transition

    // Avant le « go » : la réponse et les votes sont refusés
    host._trigger('game:answer', { roomCode: CODE, answer: 'Song 2' })
    host._trigger('game:skip-vote', { roomCode: CODE })
    guest._trigger('game:skip-vote', { roomCode: CODE })
    assert.strictEqual(roomRepository.get(CODE).players[0].score, 0)

    t.mock.timers.tick(QUESTION_TRANSITION_MS)
    assert.strictEqual(goEvents().length, 2)

    // Après le « go » : une bonne réponse compte une seule fois
    host._trigger('game:answer', { roomCode: CODE, answer: 'Song 2' })
    host._trigger('game:skip-vote', { roomCode: CODE })
    guest._trigger('game:skip-vote', { roomCode: CODE })
    assert.strictEqual(roomRepository.get(CODE).players[0].score, 1)

    // Fin du chrono de la question : pas de seconde validation
    t.mock.timers.tick(20000)
    assert.strictEqual(roomRepository.get(CODE).players[0].score, 1)
  })
})
