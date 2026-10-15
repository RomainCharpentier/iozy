import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { setupGameHandlers } from './gameHandlers.js'
import { createRoom, addPlayer } from '../domain/room.js'
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
    _trigger(event, ...args) { return events[event]?.(...args) },
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
    _getRoomEvents(roomCode) { return rooms[roomCode] || [] },
    _clear() { for (const key of Object.keys(rooms)) delete rooms[key] }
  }
}

const ROOM = 'RESTART1'
const q = (id, category) => ({ id, category, type: 'video', mediaUrl: `https://youtu.be/${id}`, answer: `Réponse ${id}` })
// 14 questions sur deux catégories, comme Animes + Jeux vidéo
const POOL = [
  ...Array.from({ length: 7 }, (_, i) => q(`anime-${i}`, 'animes')),
  ...Array.from({ length: 7 }, (_, i) => q(`jeu-${i}`, 'jeux'))
]
const ids = (questions) => questions.map(x => x.id)

function hasKey(value, key) {
  if (Array.isArray(value)) return value.some(v => hasKey(v, key))
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => k === key || hasKey(v, key))
  }
  return false
}

describe('Tirage des questions : game:start et game:restart', () => {
  let io, host

  beforeEach(() => {
    roomRepository.delete(ROOM)
    io = createMockIO()
    host = createMockSocket('socket-host')
    const room = createRoom(ROOM, 'host-id', 'socket-host', 'Host', ['animes', 'jeux'], 20)
    addPlayer(room, 'p1-id', 'socket-p1', 'P1')
    roomRepository.create(room)
    setupGameHandlers(host, io)
  })

  afterEach(() => {
    roomRepository.clearGameTimer(ROOM)
    roomRepository.delete(ROOM)
  })

  const lastStart = () => io._getRoomEvents(ROOM).filter(e => e.event === 'game:start').at(-1)

  test('game:start tire questionCount questions dans le pool et garde le pool côté serveur', async () => {
    await host._trigger('game:start', { roomCode: ROOM, questions: POOL.map(x => ({ ...x })), questionCount: 3, defaultTimeLimit: 20 })
    const room = roomRepository.get(ROOM)
    assert.strictEqual(room.questions.length, 3)
    assert.strictEqual(new Set(ids(room.questions)).size, 3)
    assert.strictEqual(room.questionPool.length, 14)
    // Le serveur garde les réponses, les clients ne les reçoivent pas
    assert.ok(room.questions.every(x => typeof x.answer === 'string'))
    const start = lastStart()
    assert.strictEqual(start.data.questions.length, 3)
    assert.strictEqual(hasKey(start.data, 'answer'), false)
  })

  test('game:start sans questionCount garde la liste reçue (compatibilité)', async () => {
    const questions = POOL.slice(0, 4).map(x => ({ ...x }))
    await host._trigger('game:start', { roomCode: ROOM, questions, defaultTimeLimit: 20 })
    assert.deepStrictEqual(ids(roomRepository.get(ROOM).questions), ids(questions))
  })

  test('game:start déduplique une question présente dans plusieurs catégories', async () => {
    const multi = q('multi', 'animes')
    const questions = [multi, { ...multi, category: 'jeux' }, q('autre', 'jeux')]
    await host._trigger('game:start', { roomCode: ROOM, questions, questionCount: 3, defaultTimeLimit: 20 })
    assert.deepStrictEqual(ids(roomRepository.get(ROOM).questions).sort(), ['autre', 'multi'])
  })

  test('game:restart fait un nouveau tirage sans reprendre les questions précédentes', async () => {
    await host._trigger('game:start', { roomCode: ROOM, questions: POOL.map(x => ({ ...x })), questionCount: 3, defaultTimeLimit: 20 })
    let previous = ids(roomRepository.get(ROOM).questions)

    for (let i = 0; i < 4; i++) {
      roomRepository.get(ROOM).gameState = 'finished'
      await host._trigger('game:restart', { roomCode: ROOM })
      const room = roomRepository.get(ROOM)
      const current = ids(room.questions)
      assert.strictEqual(current.length, 3, 'nombre de questions conservé')
      assert.strictEqual(new Set(current).size, 3)
      assert.ok(current.every(id => !previous.includes(id)), `questions reprises : ${previous} → ${current}`)
      assert.strictEqual(room.gameState, 'playing')
      assert.strictEqual(room.currentQuestionIndex, 0)

      const start = lastStart()
      assert.deepStrictEqual(ids(start.data.questions), current)
      assert.strictEqual(start.data.currentQuestion.id, current[0])
      assert.strictEqual(hasKey(start.data, 'answer'), false)
      previous = current
    }
  })

  test('game:restart avec un pool égal au nombre demandé : nouvel ordre', async () => {
    const pool = POOL.slice(0, 3).map(x => ({ ...x }))
    await host._trigger('game:start', { roomCode: ROOM, questions: pool, questionCount: 3, defaultTimeLimit: 20 })
    for (let i = 0; i < 20; i++) {
      const previous = ids(roomRepository.get(ROOM).questions)
      await host._trigger('game:restart', { roomCode: ROOM })
      const current = ids(roomRepository.get(ROOM).questions)
      assert.deepStrictEqual([...current].sort(), [...previous].sort())
      assert.notDeepStrictEqual(current, previous)
    }
  })

  test('game:restart-with-categories tire dans le nouveau pool, puis game:restart réutilise ce pool', async () => {
    await host._trigger('game:start', { roomCode: ROOM, questions: POOL.map(x => ({ ...x })), questionCount: 3, defaultTimeLimit: 20 })
    const jeux = POOL.filter(x => x.category === 'jeux').map(x => ({ ...x }))
    await host._trigger('game:restart-with-categories', { roomCode: ROOM, questions: jeux, categories: ['jeux'], questionCount: 2, defaultTimeLimit: 30 })
    let room = roomRepository.get(ROOM)
    assert.strictEqual(room.questions.length, 2)
    assert.ok(room.questions.every(x => x.category === 'jeux'))
    assert.strictEqual(room.defaultTimeLimit, 30)

    const previous = ids(room.questions)
    await host._trigger('game:restart', { roomCode: ROOM })
    room = roomRepository.get(ROOM)
    assert.strictEqual(room.questions.length, 2)
    assert.ok(room.questions.every(x => x.category === 'jeux'))
    assert.ok(ids(room.questions).every(id => !previous.includes(id)))
  })
})
