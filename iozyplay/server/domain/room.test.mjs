import { test, describe } from 'node:test'
import assert from 'node:assert'
import {
  createRoom,
  addPlayer,
  removePlayer,
  isHost,
  isWaiting,
  findPlayer,
  transferHost,
  getRoomState
} from './room.js'

describe('Room Domain', () => {
  let room

  test.beforeEach(() => {
    room = createRoom('ABC123', 'player1', 'socket1', 'Host', ['pop'], 5)
  })

  test('createRoom should create a room with host player', () => {
    assert.strictEqual(room.code, 'ABC123')
    assert.strictEqual(room.hostPlayerId, 'player1')
    assert.strictEqual(room.players.length, 1)
    assert.strictEqual(room.players[0].isHost, true)
    assert.strictEqual(room.players[0].connected, true)
    assert.strictEqual(room.gameState, 'waiting')
  })

  test('addPlayer should add a new player to the room', () => {
    const newRoom = addPlayer(room, 'player2', 'socket2', 'Player2')
    
    assert.strictEqual(newRoom.players.length, 2)
    assert.strictEqual(newRoom.players[1].id, 'player2')
    assert.strictEqual(newRoom.players[1].isHost, false)
    assert.strictEqual(newRoom.players[1].connected, true)
  })

  test('addPlayer should reconnect existing player', () => {
    addPlayer(room, 'player2', 'socket2', 'Player2')
    const reconnectedRoom = addPlayer(room, 'player2', 'socket3', 'Player2')
    
    const player = findPlayer(reconnectedRoom, 'player2')
    assert.strictEqual(player.socketId, 'socket3')
    assert.strictEqual(player.connected, true)
  })

  test('removePlayer should remove a player from the room', () => {
    addPlayer(room, 'player2', 'socket2', 'Player2')
    const updatedRoom = removePlayer(room, 'player2')
    
    assert.strictEqual(updatedRoom.players.length, 1)
    assert.strictEqual(findPlayer(updatedRoom, 'player2'), undefined)
  })

  test('isHost should return true for host player', () => {
    assert.strictEqual(isHost(room, 'socket1'), true)
    assert.strictEqual(isHost(room, 'player1'), true)
  })

  test('isHost should return false for non-host player', () => {
    addPlayer(room, 'player2', 'socket2', 'Player2')
    assert.strictEqual(isHost(room, 'socket2'), false)
  })

  test('isWaiting should return true when gameState is waiting', () => {
    assert.strictEqual(isWaiting(room), true)
  })

  test('isWaiting should return false when gameState is playing', () => {
    room.gameState = 'playing'
    assert.strictEqual(isWaiting(room), false)
  })

  test('transferHost should transfer host to another connected player', () => {
    addPlayer(room, 'player2', 'socket2', 'Player2')
    addPlayer(room, 'player3', 'socket3', 'Player3')
    
    removePlayer(room, 'player1')
    const updatedRoom = transferHost(room)
    
    assert.notStrictEqual(updatedRoom.hostPlayerId, 'player1')
    const newHost = updatedRoom.players.find(p => p.isHost)
    assert.ok(newHost)
    assert.strictEqual(newHost.id, 'player2')
  })

  test('getRoomState should return complete room state', () => {
    addPlayer(room, 'player2', 'socket2', 'Player2')
    const state = getRoomState(room)
    
    assert.strictEqual(state.code, 'ABC123')
    assert.strictEqual(state.players.length, 2)
    assert.strictEqual(state.phase, 'waiting')
    assert.ok(state.settings)
    assert.deepStrictEqual(state.settings.categories, ['pop'])
  })

  test('getRoomState should include game state when playing', () => {
    room.gameState = 'playing'
    room.game = {
      questionIndex: 0,
      startedAt: Date.now(),
      durationMs: 5000,
      readyPlayers: new Set(['player1'])
    }
    
    const state = getRoomState(room)
    assert.ok(state.game)
    assert.strictEqual(state.game.step, 'playing')
  })
})

