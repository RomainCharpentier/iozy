import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import { createServer } from 'http'
import { io as connectClient } from 'socket.io-client'
import { createExpressApp } from './server.js'
import { createSocketServer } from './socket.js'

// Garde-fou des mises à jour de dépendances (express, body-parser, qs,
// path-to-regexp, socket.io, engine.io, ws) : le vrai serveur HTTP et le vrai
// socket démarrent sous le préfixe /test et répondent.
describe('Transport HTTP et socket sous /test', () => {
  const basePath = '/test'
  let httpServer
  let io
  let baseUrl

  before(async () => {
    const app = createExpressApp({ basePath })
    // Route de test : renvoie ce que le serveur a lu (paramètre, chaîne de
    // requête, corps JSON), pour vérifier path-to-regexp, qs et body-parser.
    app.post(`${basePath}/api/echo/:id`, (req, res) => {
      res.json({ id: req.params.id, query: req.query, body: req.body })
    })
    httpServer = createServer(app)
    io = createSocketServer(httpServer, { basePath })
    io.on('connection', (socket) => {
      socket.on('echo', (payload, ack) => ack(payload))
    })
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`
  })

  after(async () => {
    await io.close()
  })

  test('la route de santé répond, avec une chaîne de requête', async () => {
    const res = await fetch(`${baseUrl}${basePath}/api/health?a[b]=1&c=2,3`)
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(await res.json(), { status: 'ok' })
  })

  test('une route inconnue répond 404', async () => {
    const res = await fetch(`${baseUrl}${basePath}/api/inconnue/42`)
    assert.strictEqual(res.status, 404)
  })

  test('le paramètre, la chaîne de requête et le JSON envoyé sont lus', async () => {
    const res = await fetch(`${baseUrl}${basePath}/api/echo/42?a[b]=1&c=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: 'Été' }),
    })
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(await res.json(), {
      id: '42',
      query: { a: { b: '1' }, c: '2' },
      body: { titre: 'Été' },
    })
  })

  test('un JSON cassé est refusé', async () => {
    const res = await fetch(`${baseUrl}${basePath}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{cassé',
    })
    assert.strictEqual(res.status, 400)
  })

  for (const transport of ['websocket', 'polling']) {
    test(`le socket fait l'aller-retour en ${transport}`, async () => {
      const client = connectClient(baseUrl, {
        path: `${basePath}/socket.io`,
        transports: [transport],
        reconnection: false,
      })
      try {
        await new Promise((resolve, reject) => {
          client.on('connect', resolve)
          client.on('connect_error', reject)
        })
        const reply = await client.timeout(2000).emitWithAck('echo', { titre: 'Été', n: [1, 2] })
        assert.deepStrictEqual(reply, { titre: 'Été', n: [1, 2] })
      } finally {
        client.close()
      }
    })
  }
})
