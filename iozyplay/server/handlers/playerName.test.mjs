import { test, describe } from 'node:test';
import assert from 'node:assert';
import { setupGameHandlers } from './gameHandlers.js';
import { setupRoomHandlers } from './roomHandlers.js';
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

const json = (value) => JSON.parse(JSON.stringify(value));
const nameOf = (players, id) => json(players).find(p => p.id === id)?.name;

const QUESTIONS = [
  { id: 'q1', category: 'pop', type: 'video', mediaUrl: 'https://youtu.be/a', answer: 'Song 1', timeLimit: 5 }
];

function newClient(io, socketId) {
  const socket = createMockSocket(socketId);
  setupRoomHandlers(socket, io);
  setupGameHandlers(socket, io);
  return socket;
}

describe('Nom des joueurs existants (room:join / room:rejoin)', () => {
  let io, host, roomCode, hostToken, guestToken;

  test.beforeEach(async () => {
    io = createMockIO();
    host = newClient(io, 'socket-host');
    host._trigger('room:create', { playerId: 'host-id', playerName: 'Hôtesse', categories: ['pop'] });
    const created = host._last('room:created').data;
    roomCode = created.roomCode;
    hostToken = created.sessionToken;

    const guest = newClient(io, 'socket-guest');
    guest._trigger('room:join', { roomCode, playerId: 'guest-id', playerName: 'Invite' });
    await flush();
    guestToken = guest._last('room:joined').data.sessionToken;
  });

  test.afterEach(() => {
    if (roomCode) {
      roomRepository.cancelGracePeriod(roomCode, 'guest-id');
      roomRepository.cancelGracePeriod(roomCode, 'host-id');
      roomRepository.delete(roomCode);
    }
  });

  for (const [label, playerName] of [
    ['sans nom', undefined],
    ['avec un nom null', null],
    ['avec un nom vide', ''],
    ['avec un nom fait d\'espaces', '   ']
  ]) {
    test(`room:join d'un joueur existant ${label} garde son nom`, async () => {
      const again = newClient(io, 'socket-guest-bis');
      again._trigger('room:join', { roomCode, playerId: 'guest-id', playerName, sessionToken: guestToken });
      await flush();

      const joined = again._last('room:joined');
      assert.ok(joined, 'room:joined attendu');
      assert.strictEqual(nameOf(joined.data.room.players, 'guest-id'), 'Invite');
      assert.strictEqual(nameOf(io._last(roomCode, 'room:state').data.players, 'guest-id'), 'Invite');
    });
  }

  test('room:join d\'un joueur existant avec un nouveau nom valide le met à jour', async () => {
    const again = newClient(io, 'socket-guest-bis');
    again._trigger('room:join', { roomCode, playerId: 'guest-id', playerName: '  Nouveau  ', sessionToken: guestToken });
    await flush();

    assert.strictEqual(nameOf(again._last('room:joined').data.room.players, 'guest-id'), 'Nouveau');
    assert.strictEqual(nameOf(io._last(roomCode, 'room:state').data.players, 'guest-id'), 'Nouveau');
  });

  test('un nom invalide (non chaîne) reste refusé', () => {
    const again = newClient(io, 'socket-guest-bis');
    again._trigger('room:join', { roomCode, playerId: 'guest-id', playerName: 42, sessionToken: guestToken });
    assert.strictEqual(again._last('error')?.data.code, 'INVALID_PAYLOAD');
    assert.strictEqual(nameOf(io._last(roomCode, 'room:state').data.players, 'guest-id'), 'Invite');
  });

  test('en cours de partie, room:join sans nom garde le nom et le score', async () => {
    host._trigger('game:start', { roomCode, questions: QUESTIONS.map(q => ({ ...q })), defaultTimeLimit: 5 });
    roomRepository.get(roomCode).players.find(p => p.id === 'guest-id').score = 3;

    const again = newClient(io, 'socket-guest-bis');
    again._trigger('room:join', { roomCode, playerId: 'guest-id', sessionToken: guestToken });
    await flush();

    const player = json(io._last(roomCode, 'room:state').data.players).find(p => p.id === 'guest-id');
    assert.strictEqual(player.name, 'Invite');
    assert.strictEqual(player.score, 3);
  });

  test('room:rejoin après déconnexion garde le nom de l\'invité et de l\'hôte', () => {
    host._trigger('disconnect', 'transport close');
    const hostAgain = newClient(io, 'socket-host-bis');
    hostAgain._trigger('room:rejoin', { roomCode, playerId: 'host-id', sessionToken: hostToken });

    const players = hostAgain._last('room:rejoined').data.room.players;
    assert.strictEqual(nameOf(players, 'host-id'), 'Hôtesse');
    assert.strictEqual(nameOf(players, 'guest-id'), 'Invite');
  });

  test('room:join de l\'hôte sans nom garde son nom', async () => {
    const hostAgain = newClient(io, 'socket-host-bis');
    hostAgain._trigger('room:join', { roomCode, playerId: 'host-id', playerName: '', sessionToken: hostToken });
    await flush();
    assert.strictEqual(nameOf(hostAgain._last('room:joined').data.room.players, 'host-id'), 'Hôtesse');
  });

  test('un nouveau joueur sans nom reçoit toujours le nom par défaut', async () => {
    const fresh = newClient(io, 'socket-fresh');
    fresh._trigger('room:join', { roomCode, playerId: 'fresh-id' });
    await flush();
    assert.strictEqual(nameOf(fresh._last('room:joined').data.room.players, 'fresh-id'), 'Joueur');
  });
});
