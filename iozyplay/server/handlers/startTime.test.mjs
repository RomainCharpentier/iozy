import { test, describe } from 'node:test';
import assert from 'node:assert';
import { setupGameHandlers } from './gameHandlers.js';
import { createRoom, addPlayer, getRoomState } from '../domain/room.js';
import { roomRepository } from '../infrastructure/roomRepository.js';

function createMockSocket(socketId) {
  const events = {};
  const emitted = [];
  return {
    id: socketId,
    on(event, handler) {
      events[event] = handler;
    },
    off() {},
    emit(event, data) {
      emitted.push({ event, data });
    },
    join() {},
    leave() {},
    connected: true,
    _trigger(event, data) {
      if (events[event]) events[event](data);
    },
    _getEmitted() {
      return emitted;
    }
  };
}

function createMockIO() {
  const rooms = {};
  return {
    to(roomCode) {
      return {
        emit(event, data) {
          if (!rooms[roomCode]) rooms[roomCode] = [];
          // Sérialisation JSON, comme Socket.IO
          rooms[roomCode].push({ event, data: JSON.parse(JSON.stringify(data)) });
        }
      };
    },
    _getRoomEvents(roomCode) {
      return rooms[roomCode] || [];
    }
  };
}

const ROOM = 'START1';
const QUESTIONS = [
  { id: 'q1', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/a', answer: 'Song 1', startTime: 42 },
  { id: 'q2', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/b', answer: 'Song 2' },
  { id: 'q3', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/c', answer: 'Song 3', startTime: -5 },
  { id: 'q4', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/d', answer: 'Song 4', startTime: '12' }
];

describe('startTime - conservé de game:start jusqu\'aux clients', () => {
  let io, host, p1;

  test.beforeEach(() => {
    io = createMockIO();
    host = createMockSocket('socket-host');
    p1 = createMockSocket('socket-p1');
    const room = createRoom(ROOM, 'host-id', 'socket-host', 'Host', ['pop'], 5);
    addPlayer(room, 'p1-id', 'socket-p1', 'P1');
    roomRepository.create(room);
    for (const s of [host, p1]) setupGameHandlers(s, io);
  });

  test.afterEach(() => {
    roomRepository.delete(ROOM);
  });

  test('game:start diffuse startTime (valide) sans la réponse', () => {
    host._trigger('game:start', { roomCode: ROOM, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5 });

    const start = io._getRoomEvents(ROOM).find(e => e.event === 'game:start');
    assert.ok(start, 'game:start émis');
    const byId = Object.fromEntries(start.data.questions.map(q => [q.id, q]));
    assert.strictEqual(byId.q1.startTime, 42);
    assert.strictEqual(byId.q1.answer, undefined);
    // Absent : reste absent
    assert.strictEqual('startTime' in byId.q2, false);
    // Invalides : retirés (le client démarre alors à 0 ou au t= de l'URL)
    assert.strictEqual('startTime' in byId.q3, false);
    assert.strictEqual('startTime' in byId.q4, false);
    // currentQuestion = première question de la partie, startTime compris
    assert.deepStrictEqual(start.data.currentQuestion, start.data.questions[0]);
  });

  test('tirage (questionCount) puis « Rejouer » : startTime suit chaque question', () => {
    host._trigger('game:start', { roomCode: ROOM, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5, questionCount: 2 });
    host._trigger('game:restart', { roomCode: ROOM });

    const starts = io._getRoomEvents(ROOM).filter(e => e.event === 'game:start');
    assert.strictEqual(starts.length, 2);
    for (const start of starts) {
      for (const question of start.data.questions) {
        if (question.id === 'q1') assert.strictEqual(question.startTime, 42);
        else assert.strictEqual('startTime' in question, false);
      }
    }
  });

  test('room:state (resync, reconnexion) conserve startTime', () => {
    host._trigger('game:start', { roomCode: ROOM, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5 });
    const state = JSON.parse(JSON.stringify(getRoomState(roomRepository.get(ROOM))));
    const q1 = state.questions.find(q => q.id === 'q1');
    assert.strictEqual(q1.startTime, 42);
    assert.strictEqual(q1.answer, undefined);
  });

  test('game:next conserve startTime de la question suivante', () => {
    const questions = [QUESTIONS[1], { ...QUESTIONS[0], id: 'q5', mediaUrl: 'https://youtu.be/e' }];
    host._trigger('game:start', { roomCode: ROOM, questions, defaultTimeLimit: 5 });
    host._trigger('game:next', { roomCode: ROOM });

    const next = io._getRoomEvents(ROOM).find(e => e.event === 'game:next');
    assert.ok(next, 'game:next émis');
    assert.strictEqual(next.data.currentQuestion.startTime, 42);
    assert.strictEqual(next.data.currentQuestion.answer, undefined);
  });

  test('les questions envoyées par l\'hôte ne sont pas modifiées', () => {
    const questions = QUESTIONS.map(q => ({ ...q }));
    host._trigger('game:start', { roomCode: ROOM, questions, defaultTimeLimit: 5 });
    assert.strictEqual(questions[2].startTime, -5);
  });
});
