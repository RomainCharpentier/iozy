/**
 * <b>What the user reads when it fails.</b>
 *
 * All the errors of the app come out of here, and two of them were
 * seen in production, in English, in the middle of a French interface:
 * "Bad Gateway" (the API not started yet behind the nginx of
 * docker-compose) and "Failed to fetch" (no response at all). This module
 * is therefore not a technical layer: it is the sentence that someone reads
 * when their screen does not display.
 *
 * <p>Three traps live in it, all invisible from the types:
 * the <b>generic Spring envelope</b> also carries an `error` field, which
 * only contains the English status phrase; the message of a <b>404</b> only
 * repeats an unreadable identifier; and a <b>cancellation</b> is not
 * a failure - turning it into an error would flash "server
 * unreachable" at every keystroke in the search.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  EVENEMENT_SESSION_PERDUE,
  buildQuery,
  declarerVisiteEnCours,
  get,
  post,
  postForm,
} from './client'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

/** An error response, with or without a JSON body. */
function echec(status: number, body?: unknown, statusText = 'Bad Gateway'): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new Error('pas de corps JSON')
      return body
    },
    headers: new Headers(),
  } as unknown as Response
}

function succes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: true,
    status,
    statusText: 'OK',
    json: async () => body,
    headers: new Headers(headers),
  } as unknown as Response
}

/** The message carried by the `ApiError` thrown, whatever the path followed. */
async function messageDe(promesse: Promise<unknown>): Promise<string> {
  return await promesse.then(
    () => 'aucune erreur levée',
    (erreur: unknown) => (erreur as Error).message,
  )
}

describe('translated errors', () => {
  it('replaces "Bad Gateway" with a sentence that says what to do', async () => {
    fetchMock.mockResolvedValue(echec(502))

    expect(await messageDe(get('/entities'))).toBe(
      "Le serveur de l'application ne répond pas - vérifiez qu'il est bien démarré.",
    )
  })

  it('says that a link leads nowhere anymore rather than "Not Found"', async () => {
    fetchMock.mockResolvedValue(echec(404, undefined, 'Not Found'))

    expect(await messageDe(get('/entities/inconnue'))).toContain("cette donnée n'existe plus")
  })

  it('keeps the code for a status that no user is supposed to see', async () => {
    fetchMock.mockResolvedValue(echec(418, undefined, "I'm a teapot"))

    expect(await messageDe(get('/entities'))).toBe('Erreur 418')
  })

  it('carries the status on the error, for the screens that tell them apart', async () => {
    fetchMock.mockResolvedValue(echec(409, { error: 'Déjà possédé' }))

    const erreur = await post('/wishlist', {}).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ApiError)
    expect((erreur as ApiError).status).toBe(409)
  })
})

describe('the server message, when it is worth it', () => {
  it('displays the reason written by the controller on a 409', async () => {
    fetchMock.mockResolvedValue(echec(409, { error: '3 tome(s) y sont encore rattachés' }))

    expect(await messageDe(post('/entities/x', {}))).toBe('3 tome(s) y sont encore rattachés')
  })

  it('displays the reason carried by the Spring envelope on a 400', async () => {
    fetchMock.mockResolvedValue(
      echec(400, { timestamp: '2026-08-29', status: 400, path: '/api/x', error: 'Bad Request', message: 'Le numéro de tome doit être positif' }),
    )

    expect(await messageDe(post('/entities/x', {}))).toBe('Le numéro de tome doit être positif')
  })

  it('does not take the status phrase of the Spring envelope for a message', async () => {
    // The trap: `error` exists in both formats, but only carries a real
    // message in the domain one.
    fetchMock.mockResolvedValue(
      echec(404, { timestamp: '2026-08-29', status: 404, path: '/api/x', error: 'Not Found', message: 'No message available' }),
    )

    expect(await messageDe(get('/entities/x'))).not.toContain('Not Found')
  })

  it('silences the message of a 404, which only repeats an identifier', async () => {
    fetchMock.mockResolvedValue(
      echec(404, {
        timestamp: '2026-08-29',
        status: 404,
        path: '/api/x',
        error: 'Not Found',
        message: 'Entity introuvable : 3f2a8c1e-0000-4000-8000-000000000000',
      }),
    )

    const message = await messageDe(get('/entities/x'))
    expect(message).not.toContain('3f2a8c1e')
    expect(message).toContain("cette donnée n'existe plus")
  })
})

describe('when the request does not even leave', () => {
  it('says in French that IozyCore is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const erreur = await get('/insights/yearlyRecap').catch((e: unknown) => e)

    expect((erreur as ApiError).message).toBe(
      'Impossible de joindre IozyCore. Vérifie que le serveur est démarré, puis réessaie.',
    )
    // 0: no response received, there is no status to report.
    expect((erreur as ApiError).status).toBe(0)
  })

  it('lets a cancellation through: it is not a failure', async () => {
    // TanStack Query cancels requests that became obsolete (debounced
    // search): translating them into "server unreachable" would flash
    // a false error at every keystroke.
    const annulation = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValue(annulation)

    const erreur = await get('/metadata/search').catch((e: unknown) => e)

    expect(erreur).toBe(annulation)
    expect(erreur).not.toBeInstanceOf(ApiError)
  })
})

describe('request bodies', () => {
  it('sets the JSON Content-Type on a JSON body', async () => {
    fetchMock.mockResolvedValue(succes({}))

    await post('/wishlist', { entityId: 'berserk' })

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"entityId":"berserk"}')
  })

  it('sets NO Content-Type on a FormData', async () => {
    // The browser must set `multipart/form-data; boundary=…` itself:
    // overwriting it would make the body unreadable on the server side, as a 415 with no clue.
    fetchMock.mockResolvedValue(succes({}))
    const form = new FormData()
    form.append('photo', new Blob(['x']), 'photo.jpg')

    await postForm('/recognition', form)

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(init.body).toBe(form)
  })

  it('returns undefined on a 204, without trying to read a body', async () => {
    fetchMock.mockResolvedValue(succes(undefined, 204))

    await expect(get('/wishlist/x')).resolves.toBeUndefined()
  })
})

describe('the session and its token', () => {
  /** The cookie that the server sets, and that only the JavaScript of this origin can read. */
  function poserJetonCsrf(valeur: string) {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => `XSRF-TOKEN=${valeur}` })
  }

  afterEach(() => {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '' })
  })

  it('sends the token back in a header on a write', () => {
    // This is what a third-party page cannot do: it does not read this
    // cookie, so it cannot forge this header.
    poserJetonCsrf('un-jeton')
    fetchMock.mockResolvedValue(succes({}))

    return post('/wishlist', {}).then(() => {
      const [, init] = fetchMock.mock.calls[0]
      expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('un-jeton')
    })
  })

  it('does not send it on a read, which changes nothing', async () => {
    poserJetonCsrf('un-jeton')
    fetchMock.mockResolvedValue(succes({}))

    await get('/entities/search')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('omits the header as long as the server has not set a token', async () => {
    fetchMock.mockResolvedValue(succes({}))

    await post('/wishlist', {})

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('always takes the session cookie along', async () => {
    fetchMock.mockResolvedValue(succes({}))

    await get('/entities/search')

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('announces only once that the session is lost, on any call', async () => {
    // The 401 can hit any request: restarted server,
    // expired session, sign-out from another tab. Each screen cannot
    // guess what its own means.
    const annonces: Event[] = []
    const ecouter = (e: Event) => annonces.push(e)
    window.addEventListener(EVENEMENT_SESSION_PERDUE, ecouter)
    fetchMock.mockResolvedValue(echec(401, undefined, 'Unauthorized'))

    await get('/entities/search').catch(() => {})

    expect(annonces).toHaveLength(1)
    window.removeEventListener(EVENEMENT_SESSION_PERDUE, ecouter)
  })

  it('does NOT announce it for "am I signed in?", whose 401 is an answer', async () => {
    const annonces: Event[] = []
    const ecouter = (e: Event) => annonces.push(e)
    window.addEventListener(EVENEMENT_SESSION_PERDUE, ecouter)
    fetchMock.mockResolvedValue(echec(401, undefined, 'Unauthorized'))

    await get('/auth/me').catch(() => {})

    expect(annonces).toHaveLength(0)
    window.removeEventListener(EVENEMENT_SESSION_PERDUE, ecouter)
  })
})

describe('buildQuery', () => {
  it('omits what is empty, null or absent', () => {
    expect(buildQuery({ q: 'berserk', entityTypeId: undefined, tagId: null, edition: '' })).toBe('?q=berserk')
  })

  it('returns nothing at all when there is no parameter', () => {
    expect(buildQuery({ q: undefined })).toBe('')
  })

  it('encodes what must be encoded', () => {
    expect(buildQuery({ q: 'a & b' })).toBe('?q=a+%26+b')
  })
})

/**
 * <b>A visit cannot write anything, and learns it right away.</b>
 *
 * The server already refuses (403 on every method other than GET for a visit
 * session), and it is THE SERVER that is the protection. This safeguard protects nothing: it
 * answers. Without it, each of the roughly forty write buttons of
 * the application would have had to be hidden one by one in its screen - and the first
 * one forgotten would have shown a red error after a network round trip, instead
 * of a sentence that explains.
 *
 * <p>The exit must stay possible: `POST /auth/logout` is the only action
 * of a visitor that must succeed, otherwise they would be locked into
 * someone else's collection until their session expires.
 */
describe('during a visit without an account', () => {
  afterEach(() => declarerVisiteEnCours(false))

  it('refuses any write WITHOUT calling the network', async () => {
    declarerVisiteEnCours(true)

    const erreur = await post('/entities', { title: 'Berserk' }).catch((cause: unknown) => cause)

    expect(erreur).toBeInstanceOf(ApiError)
    expect((erreur as ApiError).status).toBe(403)
    expect((erreur as ApiError).message).toMatch(/lecture seule/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows reading', async () => {
    declarerVisiteEnCours(true)
    fetchMock.mockResolvedValue(succes({ items: [] }))

    await expect(get('/entities/search')).resolves.toEqual({ items: [] })
  })

  it('allows leaving - sign-out is a POST, and the only one that must succeed', async () => {
    declarerVisiteEnCours(true)
    fetchMock.mockResolvedValue(succes(null, 204))

    await expect(post('/auth/logout')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalled()
  })
})
