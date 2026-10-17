import { test, describe } from 'node:test';
import assert from 'node:assert';
import { setupGameHandlers } from './gameHandlers.js';
import { setupRoomHandlers } from './roomHandlers.js';
import { DEFAULT_AVATAR, addPlayer, createRoom, toPublicPlayer } from '../domain/room.js';
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
      if (events[event]) return events[event](data);
    },
    _last(event) {
      return [...emitted].reverse().find(e => e.event === event);
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
          rooms[roomCode].push({ event, data });
        }
      };
    },
    _last(roomCode, event) {
      return [...(rooms[roomCode] || [])].reverse().find(e => e.event === event);
    }
  };
}

// Laisse passer les setImmediate (broadcast différé de room:join)
const flush = () => new Promise(resolve => setImmediate(resolve));

// Sérialisation JSON comme Socket.IO
const json = (value) => JSON.parse(JSON.stringify(value));
const avatarOf = (players, id) => json(players).find(p => p.id === id)?.avatar;

const QUESTIONS = [
  { id: 'q1', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/a', answer: 'Song 1', timeLimit: 5 }
];

function newClient(io, socketId) {
  const socket = createMockSocket(socketId);
  setupRoomHandlers(socket, io);
  setupGameHandlers(socket, io);
  return socket;
}

describe('Avatars des joueurs', () => {
  let io, host, roomCode;

  test.beforeEach(() => {
    io = createMockIO();
    host = newClient(io, 'socket-host');
    host._trigger('room:create', { playerId: 'host-id', playerName: 'Host', playerAvatar: '🦊', categories: ['pop'] });
    roomCode = host._last('room:created').data.roomCode;
  });

  test.afterEach(() => {
    if (roomCode) roomRepository.delete(roomCode);
  });

  test('room:created et room:state contiennent l\'avatar de l\'hôte', () => {
    const created = host._last('room:created').data;
    assert.strictEqual(avatarOf(created.room.players, 'host-id'), '🦊');
    assert.strictEqual(avatarOf(io._last(roomCode, 'room:state').data.players, 'host-id'), '🦊');
  });

  test('room:joined, room:state et game:start contiennent l\'avatar des joueurs', async () => {
    const p1 = newClient(io, 'socket-p1');
    p1._trigger('room:join', { roomCode, playerId: 'p1-id', playerName: 'P1', playerAvatar: '🤖' });
    await flush();

    assert.strictEqual(avatarOf(p1._last('room:joined').data.room.players, 'p1-id'), '🤖');
    const state = io._last(roomCode, 'room:state').data;
    assert.strictEqual(avatarOf(state.players, 'p1-id'), '🤖');
    assert.strictEqual(avatarOf(state.players, 'host-id'), '🦊');

    host._trigger('game:start', { roomCode, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5 });
    const start = io._last(roomCode, 'game:start').data;
    assert.strictEqual(avatarOf(start.players, 'p1-id'), '🤖');
    assert.strictEqual(avatarOf(start.players, 'host-id'), '🦊');
  });

  test('l\'avatar est conservé après une déconnexion puis room:rejoin', async () => {
    const p1 = newClient(io, 'socket-p1');
    p1._trigger('room:join', { roomCode, playerId: 'p1-id', playerName: 'P1', playerAvatar: '🤖' });
    await flush();
    const token = p1._last('room:joined').data.sessionToken;

    p1._trigger('disconnect', 'transport close');
    roomRepository.cancelGracePeriod(roomCode, 'p1-id');

    const p1Again = newClient(io, 'socket-p1-bis');
    p1Again._trigger('room:rejoin', { roomCode, playerId: 'p1-id', sessionToken: token });
    const rejoined = p1Again._last('room:rejoined').data;
    assert.strictEqual(avatarOf(rejoined.room.players, 'p1-id'), '🤖');
    assert.strictEqual(avatarOf(io._last(roomCode, 'room:state').data.players, 'p1-id'), '🤖');
  });

  test('l\'avatar est conservé quand le joueur revient via room:join sans avatar', async () => {
    const p1 = newClient(io, 'socket-p1');
    p1._trigger('room:join', { roomCode, playerId: 'p1-id', playerName: 'P1', playerAvatar: '🤖' });
    await flush();
    const token = p1._last('room:joined').data.sessionToken;

    const p1Again = newClient(io, 'socket-p1-bis');
    p1Again._trigger('room:join', { roomCode, playerId: 'p1-id', playerName: 'P1', sessionToken: token });
    assert.strictEqual(avatarOf(p1Again._last('room:joined').data.room.players, 'p1-id'), '🤖');
  });

  test('un joueur qui rejoint en cours de partie garde son avatar', () => {
    host._trigger('game:start', { roomCode, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5 });
    const late = newClient(io, 'socket-late');
    late._trigger('room:join', { roomCode, playerId: 'late-id', playerName: 'Late', playerAvatar: '🐙' });

    assert.strictEqual(avatarOf(late._last('room:joined').data.room.players, 'late-id'), '🐙');
    assert.strictEqual(avatarOf(late._last('game:start').data.players, 'late-id'), '🐙');
    assert.strictEqual(avatarOf(io._last(roomCode, 'room:state').data.players, 'late-id'), '🐙');
  });

  test('un avatar invalide ou absent est remplacé par l\'avatar par défaut', async () => {
    const invalid = [undefined, null, 42, { a: 1 }, '', '   ', 'x'.repeat(100)];
    invalid.forEach((playerAvatar, i) => {
      const s = newClient(io, `socket-inv-${i}`);
      s._trigger('room:join', { roomCode, playerId: `inv-${i}`, playerName: `J${i}`, playerAvatar });
    });
    await flush();
    const players = io._last(roomCode, 'room:state').data.players;
    invalid.forEach((_, i) => {
      assert.strictEqual(avatarOf(players, `inv-${i}`), DEFAULT_AVATAR);
    });

    const other = createMockIO();
    const h2 = newClient(other, 'socket-h2');
    h2._trigger('room:create', { playerId: 'h2', playerName: 'H2', playerAvatar: 'x'.repeat(100), categories: ['pop'] });
    const created = h2._last('room:created').data;
    assert.strictEqual(avatarOf(created.room.players, 'h2'), DEFAULT_AVATAR);
    roomRepository.delete(created.roomCode);
  });
});

describe('Avatars - domaine', () => {
  test('addPlayer ne remplace pas l\'avatar d\'un joueur existant quand aucun n\'est fourni', () => {
    const room = createRoom('DOM1', 'h', 's-h', 'H', ['pop']);
    addPlayer(room, 'p', 's-p', 'P', '🤖');
    addPlayer(room, 'p', 's-p2', 'P');
    assert.strictEqual(room.players.find(p => p.id === 'p').avatar, '🤖');
    assert.strictEqual(room.players.find(p => p.id === 'h').avatar, DEFAULT_AVATAR);
  });

  test('toPublicPlayer expose toujours un avatar', () => {
    assert.strictEqual(toPublicPlayer({ id: 'a', name: 'A', score: 0 }).avatar, DEFAULT_AVATAR);
    assert.strictEqual(toPublicPlayer({ id: 'a', name: 'A', avatar: '🤖', score: 0 }).avatar, '🤖');
  });
});
