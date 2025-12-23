import { test, describe } from 'node:test'
import assert from 'node:assert'
import { setupGameHandlers } from './gameHandlers.js'
import { createRoom, addPlayer } from '../domain/room.js'
import { roomRepository } from '../infrastructure/roomRepository.js'

// Mock Socket.IO simple
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
      if (events[event]) {
        events[event](data)
      }
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
          rooms[roomCode].push({ event, data, timestamp: Date.now() })
        }
      }
    },
    _getRoomEvents(roomCode) {
      return rooms[roomCode] || []
    }
  }
}

describe('Game Handlers - Synchronization', () => {
  let io
  let hostSocket
  let player1Socket
  let player2Socket

  test.beforeEach(() => {
    io = createMockIO()
    hostSocket = createMockSocket('socket-host')
    player1Socket = createMockSocket('socket-player1')
    player2Socket = createMockSocket('socket-player2')

    const room = createRoom('TEST123', 'host-id', 'socket-host', 'Host', ['pop'], 5)
    addPlayer(room, 'player1-id', 'socket-player1', 'Player1')
    addPlayer(room, 'player2-id', 'socket-player2', 'Player2')
    
    roomRepository.create(room)
    
    setupGameHandlers(hostSocket, io)
    setupGameHandlers(player1Socket, io)
    setupGameHandlers(player2Socket, io)
  })

  test('should wait for all players before sending game:go', () => {
    const questions = [{ id: 'q1', answer: 'Song 1', timeLimit: 5 }]

    // Host starts game
    hostSocket._trigger('game:start', {
      roomCode: 'TEST123',
      questions,
      defaultTimeLimit: 5
    })

    // Player 1 ready
    player1Socket._trigger('game:ready', { roomCode: 'TEST123' })
    
    // Should not send game:go yet (only 1 player ready out of 3)
    const eventsAfterPlayer1 = io._getRoomEvents('TEST123')
    const goEvents1 = eventsAfterPlayer1.filter(e => e.event === 'game:go')
    assert.strictEqual(goEvents1.length, 0)

    // Player 2 ready (now 2 out of 3, still not all)
    player2Socket._trigger('game:ready', { roomCode: 'TEST123' })
    
    // Still should not send game:go (host not ready)
    const eventsAfterPlayer2 = io._getRoomEvents('TEST123')
    const goEvents2 = eventsAfterPlayer2.filter(e => e.event === 'game:go')
    assert.strictEqual(goEvents2.length, 0)

    // Host ready (now all 3 players ready)
    hostSocket._trigger('game:ready', { roomCode: 'TEST123' })
    
    // Now should send game:go
    const eventsAfterAll = io._getRoomEvents('TEST123')
    const goEventsAfterAll = eventsAfterAll.filter(e => e.event === 'game:go')
    assert.ok(goEventsAfterAll.length > 0)
    
    const goEvent = goEventsAfterAll[0]
    assert.ok(goEvent.data.goAt)
    assert.ok(goEvent.data.startedAt)
    assert.strictEqual(goEvent.data.durationMs, 5000)
  })

  test('should send game:go with correct timing (1.5s in future)', () => {
    const questions = [{ id: 'q1', answer: 'Song 1', timeLimit: 5 }]
    
    hostSocket._trigger('game:start', {
      roomCode: 'TEST123',
      questions,
      defaultTimeLimit: 5
    })

    const beforeReady = Date.now()
    player1Socket._trigger('game:ready', { roomCode: 'TEST123' })
    player2Socket._trigger('game:ready', { roomCode: 'TEST123' })
    hostSocket._trigger('game:ready', { roomCode: 'TEST123' })
    const afterReady = Date.now()

    const events = io._getRoomEvents('TEST123')
    const goEvent = events.find(e => e.event === 'game:go')
    
    assert.ok(goEvent)
    const goAt = goEvent.data.goAt
    const expectedMin = beforeReady + 1500
    const expectedMax = afterReady + 1500
    
    assert.ok(goAt >= expectedMin)
    assert.ok(goAt <= expectedMax)
  })

  test('should reset readyPlayers when moving to next question', () => {
    const questions = [
      { id: 'q1', answer: 'Song 1', timeLimit: 5 },
      { id: 'q2', answer: 'Song 2', timeLimit: 5 }
    ]

    // Start game
    hostSocket._trigger('game:start', {
      roomCode: 'TEST123',
      questions,
      defaultTimeLimit: 5
    })

    // All players ready
    player1Socket._trigger('game:ready', { roomCode: 'TEST123' })
    player2Socket._trigger('game:ready', { roomCode: 'TEST123' })
    hostSocket._trigger('game:ready', { roomCode: 'TEST123' })

    // Move to next question
    hostSocket._trigger('game:next', { roomCode: 'TEST123' })

    const updatedRoom = roomRepository.get('TEST123')
    assert.strictEqual(updatedRoom.game.readyPlayers.size, 0)
    assert.strictEqual(updatedRoom.game.goAt, null)
    assert.strictEqual(updatedRoom.game.startedAt, null)
  })
})

