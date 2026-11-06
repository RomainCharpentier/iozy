/**
 * Tests unitaires pour le singleton socket et la reconnexion automatique à la room
 */
import { vi, beforeEach, describe, it, expect } from 'vitest'

type Handler = (...args: unknown[]) => void

// Mini émetteur d'événements pour simuler Socket et Manager de socket.io-client
class FakeEmitter {
  handlers = new Map<string, Handler[]>()
  on(event: string, fn: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn])
    return this
  }
  trigger(event: string, ...args: unknown[]) {
    ;(this.handlers.get(event) ?? []).forEach((fn) => fn(...args))
  }
}

class FakeSocket extends FakeEmitter {
  id = 'socket-1'
  connected = false
  active = true
  io = new FakeEmitter()
  emit = vi.fn()
  connect = vi.fn(() => {
    this.active = true
  })
  disconnect = vi.fn(() => {
    this.connected = false
    this.active = false
  })
  simulateConnect() {
    this.connected = true
    this.trigger('connect')
  }
  simulateDisconnect(reason = 'transport close') {
    this.connected = false
    this.trigger('disconnect', reason)
  }
}

const created: FakeSocket[] = []

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const s = new FakeSocket()
    created.push(s)
    return s
  }),
}))

vi.mock('@/utils/playerId', () => ({
  getPlayerId: () => 'player-uuid',
}))

const loadModule = async () => {
  vi.resetModules()
  return import('@/utils/socket')
}

describe('utils/socket', () => {
  beforeEach(() => {
    created.length = 0
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('connectSocket est idempotent, même pendant la connexion', async () => {
    const { connectSocket } = await loadModule()
    const a = connectSocket()
    const b = connectSocket()
    expect(a).toBe(b)
    expect(created).toHaveLength(1)
  })

  it("relance la connexion d'un socket déconnecté manuellement sans en recréer un", async () => {
    const { connectSocket, disconnectSocketIfConnected } = await loadModule()
    const s = connectSocket() as unknown as FakeSocket
    s.simulateConnect()
    disconnectSocketIfConnected()
    expect(s.disconnect).toHaveBeenCalled()

    const again = connectSocket()
    expect(again).toBe(s)
    expect(s.connect).toHaveBeenCalledTimes(1)
    expect(created).toHaveLength(1)
  })

  it("n'émet pas room:rejoin à la première connexion", async () => {
    const { connectSocket, setCurrentRoom } = await loadModule()
    const s = connectSocket() as unknown as FakeSocket
    setCurrentRoom('ABCD')
    s.simulateConnect()
    expect(s.emit).not.toHaveBeenCalledWith('room:rejoin', expect.anything())
  })

  it('émet room:rejoin à chaque reconnexion si une room est active', async () => {
    const { connectSocket, setCurrentRoom } = await loadModule()
    const s = connectSocket() as unknown as FakeSocket
    s.simulateConnect()
    setCurrentRoom('ABCD')

    // Même socket.id conservé (connectionStateRecovery) : on réintègre quand même la room
    s.simulateDisconnect()
    s.simulateConnect()
    expect(s.emit).toHaveBeenCalledWith('room:rejoin', {
      roomCode: 'ABCD',
      playerId: 'player-uuid',
    })

    s.simulateDisconnect()
    s.simulateConnect()
    expect(s.emit.mock.calls.filter(([e]) => e === 'room:rejoin')).toHaveLength(2)
  })

  it("n'émet pas room:rejoin après avoir quitté la room", async () => {
    const { connectSocket, setCurrentRoom, clearCurrentRoom } = await loadModule()
    const s = connectSocket() as unknown as FakeSocket
    s.simulateConnect()
    setCurrentRoom('ABCD')
    clearCurrentRoom('ABCD')

    s.simulateDisconnect()
    s.simulateConnect()
    expect(s.emit).not.toHaveBeenCalledWith('room:rejoin', expect.anything())
  })

  it("clearCurrentRoom n'efface pas une autre room", async () => {
    const { setCurrentRoom, clearCurrentRoom, getCurrentRoom } = await loadModule()
    setCurrentRoom('NEW1')
    clearCurrentRoom('OLD1')
    expect(getCurrentRoom()).toBe('NEW1')
    clearCurrentRoom()
    expect(getCurrentRoom()).toBeNull()
  })

  it('écoute les événements de reconnexion sur le Manager, pas sur le Socket', async () => {
    const { connectSocket } = await loadModule()
    const s = connectSocket() as unknown as FakeSocket
    expect(s.handlers.has('reconnect')).toBe(false)
    expect(s.io.handlers.has('reconnect_attempt')).toBe(true)
  })
})
