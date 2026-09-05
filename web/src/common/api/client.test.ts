/**
 * <b>Ce que l'utilisateur lit quand ça rate.</b>
 *
 * Toutes les erreurs de l'app sortent d'ici, et deux d'entre elles ont été
 * vues en production, en anglais, au milieu d'une interface française :
 * « Bad Gateway » (l'API pas encore démarrée derrière le nginx de
 * docker-compose) et « Failed to fetch » (aucune réponse du tout). Ce module
 * n'est donc pas une couche technique : c'est la phrase que quelqu'un lit
 * quand son écran ne s'affiche pas.
 *
 * <p>Trois pièges s'y logent, tous invisibles depuis les types :
 * l'<b>enveloppe générique de Spring</b> porte elle aussi un champ `error`, qui
 * n'y contient que la phrase de statut anglaise ; le message d'un <b>404</b> ne
 * fait que répéter un identifiant illisible ; et une <b>annulation</b> n'est
 * pas une panne - la transformer en erreur ferait clignoter « serveur
 * injoignable » à chaque frappe dans la recherche.
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

/** Une réponse d'erreur, avec ou sans corps JSON. */
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

/** Le message porté par l'`ApiError` levée, quel que soit le chemin suivi. */
async function messageDe(promesse: Promise<unknown>): Promise<string> {
  return await promesse.then(
    () => 'aucune erreur levée',
    (erreur: unknown) => (erreur as Error).message,
  )
}

describe('les erreurs traduites', () => {
  it('remplace « Bad Gateway » par une phrase qui dit quoi faire', async () => {
    fetchMock.mockResolvedValue(echec(502))

    expect(await messageDe(get('/entities'))).toBe(
      "Le serveur de l'application ne répond pas - vérifiez qu'il est bien démarré.",
    )
  })

  it('dit qu’un lien ne mène plus nulle part plutôt que « Not Found »', async () => {
    fetchMock.mockResolvedValue(echec(404, undefined, 'Not Found'))

    expect(await messageDe(get('/entities/inconnue'))).toContain("cette donnée n'existe plus")
  })

  it('garde le code pour un statut qu’aucun utilisateur n’est censé voir', async () => {
    fetchMock.mockResolvedValue(echec(418, undefined, "I'm a teapot"))

    expect(await messageDe(get('/entities'))).toBe('Erreur 418')
  })

  it('porte le statut sur l’erreur, pour les écrans qui le distinguent', async () => {
    fetchMock.mockResolvedValue(echec(409, { error: 'Déjà possédé' }))

    const erreur = await post('/wishlist', {}).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(ApiError)
    expect((erreur as ApiError).status).toBe(409)
  })
})

describe('le message du serveur, quand il en vaut la peine', () => {
  it('affiche la raison écrite par le contrôleur sur un 409', async () => {
    fetchMock.mockResolvedValue(echec(409, { error: '3 tome(s) y sont encore rattachés' }))

    expect(await messageDe(post('/entities/x', {}))).toBe('3 tome(s) y sont encore rattachés')
  })

  it('affiche la raison portée par l’enveloppe Spring sur un 400', async () => {
    fetchMock.mockResolvedValue(
      echec(400, { timestamp: '2026-08-29', status: 400, path: '/api/x', error: 'Bad Request', message: 'Le numéro de tome doit être positif' }),
    )

    expect(await messageDe(post('/entities/x', {}))).toBe('Le numéro de tome doit être positif')
  })

  it('ne prend pas la phrase de statut de l’enveloppe Spring pour un message', async () => {
    // Le piège : `error` existe dans les deux formats, mais ne porte un vrai
    // message que dans celui du domaine.
    fetchMock.mockResolvedValue(
      echec(404, { timestamp: '2026-08-29', status: 404, path: '/api/x', error: 'Not Found', message: 'No message available' }),
    )

    expect(await messageDe(get('/entities/x'))).not.toContain('Not Found')
  })

  it('tait le message d’un 404, qui ne fait que répéter un identifiant', async () => {
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

describe('quand la requête ne part même pas', () => {
  it('dit en français que IozyCore est injoignable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const erreur = await get('/insights/yearlyRecap').catch((e: unknown) => e)

    expect((erreur as ApiError).message).toBe(
      'Impossible de joindre IozyCore. Vérifie que le serveur est démarré, puis réessaie.',
    )
    // 0 : aucune réponse reçue, il n'y a pas de statut à rapporter.
    expect((erreur as ApiError).status).toBe(0)
  })

  it('laisse passer une annulation : ce n’est pas une panne', async () => {
    // TanStack Query annule les requêtes devenues obsolètes (recherche
    // débouncée) : les traduire en « serveur injoignable » ferait clignoter
    // une fausse erreur à chaque frappe.
    const annulation = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValue(annulation)

    const erreur = await get('/metadata/search').catch((e: unknown) => e)

    expect(erreur).toBe(annulation)
    expect(erreur).not.toBeInstanceOf(ApiError)
  })
})

describe('les corps de requête', () => {
  it('pose le Content-Type JSON sur un corps JSON', async () => {
    fetchMock.mockResolvedValue(succes({}))

    await post('/wishlist', { entityId: 'berserk' })

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"entityId":"berserk"}')
  })

  it('ne pose AUCUN Content-Type sur un FormData', async () => {
    // Le navigateur doit poser lui-même `multipart/form-data; boundary=…` :
    // l'écraser rendrait le corps illisible côté serveur, en 415 sans indice.
    fetchMock.mockResolvedValue(succes({}))
    const form = new FormData()
    form.append('photo', new Blob(['x']), 'photo.jpg')

    await postForm('/recognition', form)

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(init.body).toBe(form)
  })

  it('rend undefined sur un 204, sans tenter de lire un corps', async () => {
    fetchMock.mockResolvedValue(succes(undefined, 204))

    await expect(get('/wishlist/x')).resolves.toBeUndefined()
  })
})

describe('la session et son jeton', () => {
  /** Le cookie que le serveur dépose, et que seul le JavaScript de cette origine peut lire. */
  function poserJetonCsrf(valeur: string) {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => `XSRF-TOKEN=${valeur}` })
  }

  afterEach(() => {
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '' })
  })

  it('renvoie le jeton en en-tête sur une écriture', () => {
    // C'est ce qu'une page tierce ne peut pas faire : elle ne lit pas ce
    // cookie, donc elle ne peut pas forger cet en-tête.
    poserJetonCsrf('un-jeton')
    fetchMock.mockResolvedValue(succes({}))

    return post('/wishlist', {}).then(() => {
      const [, init] = fetchMock.mock.calls[0]
      expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('un-jeton')
    })
  })

  it('ne l’envoie pas sur une lecture, qui ne modifie rien', async () => {
    poserJetonCsrf('un-jeton')
    fetchMock.mockResolvedValue(succes({}))

    await get('/entities/search')

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('omet l’en-tête tant que le serveur n’a pas déposé de jeton', async () => {
    fetchMock.mockResolvedValue(succes({}))

    await post('/wishlist', {})

    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('emmène toujours le cookie de session', async () => {
    fetchMock.mockResolvedValue(succes({}))

    await get('/entities/search')

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('annonce une seule fois que la session est perdue, sur n’importe quel appel', async () => {
    // Le 401 peut tomber sur n'importe quelle requête : serveur redémarré,
    // session expirée, déconnexion depuis un autre onglet. Chaque écran ne
    // peut pas deviner ce que veut dire le sien.
    const annonces: Event[] = []
    const ecouter = (e: Event) => annonces.push(e)
    window.addEventListener(EVENEMENT_SESSION_PERDUE, ecouter)
    fetchMock.mockResolvedValue(echec(401, undefined, 'Unauthorized'))

    await get('/entities/search').catch(() => {})

    expect(annonces).toHaveLength(1)
    window.removeEventListener(EVENEMENT_SESSION_PERDUE, ecouter)
  })

  it('ne l’annonce PAS pour « suis-je connecté ? », dont le 401 est une réponse', async () => {
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
  it('omet ce qui est vide, nul ou absent', () => {
    expect(buildQuery({ q: 'berserk', entityTypeId: undefined, tagId: null, edition: '' })).toBe('?q=berserk')
  })

  it('ne rend rien du tout quand il n’y a aucun paramètre', () => {
    expect(buildQuery({ q: undefined })).toBe('')
  })

  it('encode ce qui doit l’être', () => {
    expect(buildQuery({ q: 'a & b' })).toBe('?q=a+%26+b')
  })
})

/**
 * <b>Une visite ne peut rien écrire, et l'apprend tout de suite.</b>
 *
 * Le serveur refuse déjà (403 sur toute méthode autre que GET pour une session
 * de visite), et c'est LUI la protection. Ce garde-fou-ci ne protège rien : il
 * répond. Sans lui, chacun des quelque quarante boutons d'écriture de
 * l'application aurait dû être masqué un par un dans son écran - et le premier
 * oublié aurait affiché une erreur rouge après un aller-retour réseau, au lieu
 * d'une phrase qui explique.
 *
 * <p>La sortie doit rester possible : `POST /auth/logout` est le seul geste
 * d'un visiteur qui doive aboutir, sans quoi il serait enfermé dans la
 * collection de quelqu'un d'autre jusqu'à expiration de sa session.
 */
describe('pendant une visite sans compte', () => {
  afterEach(() => declarerVisiteEnCours(false))

  it('refuse toute écriture SANS appeler le réseau', async () => {
    declarerVisiteEnCours(true)

    const erreur = await post('/entities', { title: 'Berserk' }).catch((cause: unknown) => cause)

    expect(erreur).toBeInstanceOf(ApiError)
    expect((erreur as ApiError).status).toBe(403)
    expect((erreur as ApiError).message).toMatch(/lecture seule/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('laisse lire', async () => {
    declarerVisiteEnCours(true)
    fetchMock.mockResolvedValue(succes({ items: [] }))

    await expect(get('/entities/search')).resolves.toEqual({ items: [] })
  })

  it('laisse sortir - la déconnexion est un POST, et le seul qui doive aboutir', async () => {
    declarerVisiteEnCours(true)
    fetchMock.mockResolvedValue(succes(null, 204))

    await expect(post('/auth/logout')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalled()
  })
})
