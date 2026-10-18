import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Le worker lui-même (public/sw.js), chargé avec un `self` et un `caches`
// factices : on exerce ses décisions, pas le navigateur.
const script = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

type Handler = (event: Record<string, unknown>) => void

function fakeCaches(existing: string[]) {
  const opened: string[] = []
  const precached: string[][] = []
  const deleted: string[] = []
  const cache = {
    addAll: async (urls: string[]) => {
      precached.push(urls)
    },
    match: async () => undefined,
    put: async () => undefined,
  }
  const api = {
    open: async (name: string) => {
      opened.push(name)
      return cache
    },
    keys: async () => existing,
    delete: async (name: string) => {
      deleted.push(name)
      return true
    },
  }
  return { api, opened, precached, deleted }
}

function loadWorker(caches: ReturnType<typeof fakeCaches>['api'], scriptUrl = 'http://localhost:8081/play/sw.js') {
  const handlers: Record<string, Handler> = {}
  const self = {
    location: { href: scriptUrl, origin: new URL(scriptUrl).origin },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler
    },
    skipWaiting: () => undefined,
    clients: { claim: () => undefined },
  }
  const silent = { log: () => undefined, warn: () => undefined, error: () => undefined }
  new Function('self', 'caches', 'console', script)(self, caches, silent)
  return handlers
}

async function fire(handler: Handler) {
  let pending: Promise<unknown> = Promise.resolve()
  handler({ waitUntil: (promise) => void (pending = promise) })
  await pending
}

describe('public/sw.js', () => {
  afterEach(() => vi.useRealTimers())

  it('précache la coquille sous le préfixe où le script est servi', async () => {
    const caches = fakeCaches([])
    await fire(loadWorker(caches.api).install)
    expect(caches.precached).toEqual([['/play/', '/play/index.html', '/play/offline.html']])
  })

  it("purge à l'activation tout cache qui n'est pas le sien, et garde les siens", async () => {
    const caches = fakeCaches(['blindtest-20261017', 'blindtest-20261018-runtime', 'iozyplay-v1', 'iozyplay-v1-runtime'])
    await fire(loadWorker(caches.api).activate)
    expect(caches.deleted).toEqual(['blindtest-20261017', 'blindtest-20261018-runtime'])
  })

  it("laisse passer l'API commune du site et ne sert que sous son préfixe", () => {
    const handlers = loadWorker(fakeCaches([]).api)
    const handled = (url: string) => {
      let responded = false
      handlers.fetch({ request: { url, method: 'GET' }, respondWith: () => void (responded = true) })
      return responded
    }
    expect(handled('http://localhost:8081/api/auth/me')).toBe(false)
    expect(handled('http://localhost:8081/core/')).toBe(false)
    expect(handled('http://localhost:8081/play/socket.io/?EIO=4')).toBe(false)
    expect(handled('http://localhost:8081/play/api/health')).toBe(true)
    expect(handled('http://localhost:8081/play/assets/index-abc.js')).toBe(true)
  })

  it("ouvre le même cache d'un jour à l'autre : rien ne s'accumule", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T10:00:00Z'))
    const today = fakeCaches([])
    await fire(loadWorker(today.api).install)
    vi.setSystemTime(new Date('2026-10-19T10:00:00Z'))
    const tomorrow = fakeCaches([])
    await fire(loadWorker(tomorrow.api).install)
    expect(tomorrow.opened).toEqual(today.opened)
  })
})
