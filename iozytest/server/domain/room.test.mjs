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
  getRoomState,
  issueSessionToken,
  verifySessionToken,
  toPublicQuestion
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

describe('Room Domain - sécurité', () => {
  let room

  test.beforeEach(() => {
    room = createRoom('ABC123', 'player1', 'socket1', 'Host', ['pop'], 5)
  })

  test('getRoomState ne diffuse ni socketId ni jetons de session', () => {
    issueSessionToken(room, 'player1')
    const state = getRoomState(room)
    assert.strictEqual(state.players[0].socketId, undefined)
    assert.strictEqual(state.sessionTokens, undefined)
    assert.ok(!JSON.stringify(state).includes(room.sessionTokens.player1))
  })

  test('getRoomState retire answer des questions et les réponses des joueurs', () => {
    room.gameState = 'playing'
    room.questions = [{ id: 'q1', answer: 'Secret', hint: 'Indice' }]
    room.game = {
      questionIndex: 0,
      startedAt: Date.now(),
      durationMs: 5000,
      answers: { player1: 'Secret' },
      readyPlayers: new Set(['player1']),
      validatedAnswers: {}
    }
    const state = getRoomState(room)
    assert.strictEqual(state.questions[0].answer, undefined)
    assert.strictEqual(state.questions[0].hint, 'Indice')
    assert.strictEqual(state.game.answers, undefined)
    assert.deepStrictEqual(state.game.answeredPlayers, ['player1'])
    assert.strictEqual(state.game.correctAnswer, undefined)
    assert.ok(!JSON.stringify(state).includes('Secret'))
    // L'objet room n'est pas modifié
    assert.strictEqual(room.questions[0].answer, 'Secret')
    assert.deepStrictEqual(room.game.answers, { player1: 'Secret' })
  })

  test('getRoomState donne la bonne réponse une fois les réponses validées', () => {
    room.gameState = 'playing'
    room.questions = [{ id: 'q1', answer: 'Secret' }]
    room.game = {
      questionIndex: 0,
      startedAt: Date.now(),
      durationMs: 5000,
      answers: {},
      readyPlayers: new Set(),
      validatedAnswers: { _validated: true }
    }
    assert.strictEqual(getRoomState(room).game.correctAnswer, 'Secret')
  })

  test('toPublicQuestion ne mute pas la question', () => {
    const q = { id: 'q1', answer: 'A' }
    assert.deepStrictEqual(toPublicQuestion(q), { id: 'q1' })
    assert.strictEqual(q.answer, 'A')
  })

  test('verifySessionToken accepte seulement le jeton du joueur', () => {
    const token = issueSessionToken(room, 'player1')
    addPlayer(room, 'player2', 'socket2', 'Player2')
    const token2 = issueSessionToken(room, 'player2')
    assert.strictEqual(verifySessionToken(room, 'player1', token), true)
    assert.strictEqual(verifySessionToken(room, 'player1', token2), false)
    assert.strictEqual(verifySessionToken(room, 'player1', undefined), false)
    assert.strictEqual(verifySessionToken(room, 'player1', ''), false)
    assert.strictEqual(verifySessionToken(room, 'unknown', token), false)
  })

  test('removePlayer révoque le jeton de session', () => {
    const token = issueSessionToken(room, 'player1')
    removePlayer(room, 'player1')
    assert.strictEqual(verifySessionToken(room, 'player1', token), false)
  })
})
