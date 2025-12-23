import { test, describe } from 'node:test'
import assert from 'node:assert'
import { startGame, checkAnswer, nextQuestion } from './game.js'
import { createRoom, addPlayer } from './room.js'

describe('Game Domain', () => {
  let room
  const questions = [
    { id: 'q1', answer: 'Song 1', timeLimit: 5 },
    { id: 'q2', answer: 'Song 2', timeLimit: 5 },
    { id: 'q3', answer: 'Song 3', timeLimit: 5 }
  ]

  test.beforeEach(() => {
    room = createRoom('ABC123', 'player1', 'socket1', 'Host', ['pop'], 5)
    addPlayer(room, 'player2', 'socket2', 'Player2')
  })

  test('startGame should initialize game state', () => {
    const updatedRoom = startGame(room, questions, 5)
    
    assert.strictEqual(updatedRoom.gameState, 'playing')
    assert.deepStrictEqual(updatedRoom.questions, questions)
    assert.strictEqual(updatedRoom.currentQuestionIndex, 0)
    assert.ok(updatedRoom.game)
    assert.strictEqual(updatedRoom.game.questionIndex, 0)
    assert.strictEqual(updatedRoom.game.durationMs, 5000)
    assert.ok(updatedRoom.game.readyPlayers instanceof Set)
  })

  test('checkAnswer should accept correct answer and update score', () => {
    startGame(room, questions, 5)
    room.game.startedAt = Date.now()
    
    const result = checkAnswer(room, 'socket1', 'Song 1')
    
    assert.strictEqual(result.isValid, true)
    assert.strictEqual(result.isCorrect, true)
    assert.strictEqual(result.player.score, 1)
  })

  test('checkAnswer should reject incorrect answer', () => {
    startGame(room, questions, 5)
    room.game.startedAt = Date.now()
    
    const result = checkAnswer(room, 'socket1', 'Wrong Answer')
    
    assert.strictEqual(result.isValid, true)
    assert.strictEqual(result.isCorrect, false)
    assert.strictEqual(result.player.score, 0)
  })

  test('checkAnswer should allow multiple answers', () => {
    startGame(room, questions, 5)
    room.game.startedAt = Date.now()
    
    const result1 = checkAnswer(room, 'socket1', 'Song 1')
    assert.strictEqual(result1.isValid, true)
    assert.strictEqual(result1.isCorrect, true)
    
    // Le joueur peut répondre plusieurs fois
    const result2 = checkAnswer(room, 'socket1', 'Song 1')
    assert.strictEqual(result2.isValid, true)
    assert.strictEqual(result2.isCorrect, true)
    
    // Le score augmente à chaque bonne réponse
    const player = room.players.find(p => p.id === 'player1')
    assert.strictEqual(player.score, 2)
  })

  test('nextQuestion should advance to next question', () => {
    startGame(room, questions, 5)
    room.game.startedAt = Date.now()
    
    const result = nextQuestion(room)
    
    assert.strictEqual(result.questionIndex, 1)
    assert.deepStrictEqual(result.currentQuestion, questions[1])
    assert.strictEqual(room.currentQuestionIndex, 1)
    assert.strictEqual(room.game.questionIndex, 1)
  })

  test('nextQuestion should reset readyPlayers and goAt for new question', () => {
    startGame(room, questions, 5)
    room.game.readyPlayers.add('player1')
    room.game.goAt = Date.now()
    
    const result = nextQuestion(room)
    
    assert.strictEqual(result.room.game.readyPlayers.size, 0)
    assert.strictEqual(result.room.game.goAt, null)
    assert.strictEqual(result.room.game.startedAt, null)
  })

  test('nextQuestion should mark game as finished on last question', () => {
    startGame(room, questions, 5)
    room.currentQuestionIndex = 2
    room.game.questionIndex = 2
    
    const result = nextQuestion(room)
    
    assert.strictEqual(result.isFinished, true)
    assert.strictEqual(room.gameState, 'finished')
  })
})

