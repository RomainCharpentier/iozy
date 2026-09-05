// Client HTTP minimal, un peu comme APIClient.swift côté iOS : pas de couche
// d'abstraction supplémentaire, les modules api/*.ts appellent request()
// directement et sont eux-mêmes appelés depuis les hooks TanStack Query des
// écrans.
//
// Gestion des erreurs : le backend renvoie deux formats différents selon le
// type d'exception (voir ApiExceptionHandler.java) -
//   - exceptions domaine (409/400) -> { "error": "message" }
//   - ResponseStatusException (404, certains 400) -> passe par le formateur
//     Spring par défaut, qui n'inclut PAS le message détaillé du contrôleur
//     tant que server.error.include-message=always n'est pas positionné
//     (ce n'est pas le cas dans application.yml) - donc ces erreurs
//     remontent un texte générique ("Not Found"), pas le message précis.
// On tente body.error en priorité, sinon on retombe sur statusText.

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Repli quand le backend n'a pas fourni de message exploitable : statusText
// vaut alors "Not Found"/"Forbidden", de l'anglais brut affiché tel quel dans
// une interface entièrement en français (constaté sur la fiche d'une œuvre
// supprimée). On traduit les statuts qu'un utilisateur peut réellement
// rencontrer, et on garde le code pour les autres.
const MESSAGES_PAR_STATUT: Record<number, string> = {
  400: "Requête invalide.",
  401: "Accès refusé.",
  403: "Accès refusé.",
  404: "Introuvable - cette donnée n'existe plus, ou le lien est erroné.",
  409: "Opération impossible dans l'état actuel.",
  500: "Erreur du serveur.",
  // 502/504 : le serveur applicatif ne répond pas DERRIÈRE le serveur web. En
  // développement (`npm run dev`) l'appel échoue avant d'aboutir et tombe dans
  // MESSAGE_HORS_LIGNE ; mais l'application telle qu'elle est déployée passe par
  // le nginx de docker-compose, qui répond lui, avec un 502 - la panne la plus
  // ordinaire de cette application (conteneur API pas encore démarré, ou
  // arrêté). Sans ces deux lignes, le repli affichait la phrase de statut
  // anglaise, « Bad Gateway », dans une interface entièrement en français.
  502: "Le serveur de l'application ne répond pas - vérifiez qu'il est bien démarré.",
  503: "Service indisponible, réessayez dans un instant.",
  504: "Le serveur de l'application ne répond pas - vérifiez qu'il est bien démarré.",
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    // Piège : l'enveloppe générique de Spring porte ELLE AUSSI un champ
    // "error", qui n'y contient pas un message mais la phrase de statut HTTP
    // ("Not Found"). La reconnaître à sa forme (timestamp + status + path)
    // évite d'afficher cet anglais brut au lieu du repli traduit.
    const enveloppeSpring = body && 'timestamp' in body && 'status' in body
    // Enveloppe Spring : "error" ne porte que la phrase de statut, mais
    // "message" porte la raison écrite par le contrôleur quand il y en a une
    // (server.error.include-message: always). Spring y met "No message
    // available" lorsqu'il n'y en a pas - à ignorer, le repli traduit dit
    // mieux les choses.
    if (enveloppeSpring) {
      const raison = typeof body.message === 'string' ? body.message.trim() : ''
      // Sauf en 404 : là, le message ne fait que nommer l'identifiant absent
      // ("Entity introuvable : 3f2a...-9c1e"), ce qui n'apprend rien à qui lit.
      // Le repli traduit dit la seule chose utile - le lien ne mène plus nulle
      // part. Aux autres statuts (409/400 surtout), le message EST la raison
      // actionnable ("3 tome(s) y sont encore rattachés") : on l'affiche.
      const utile = raison && raison !== 'No message available' && response.status !== 404
      if (utile) return raison
    } else if (typeof body?.error === 'string') {
      return body.error
    }
  } catch {
    // pas de corps JSON exploitable, on retombe sur le repli ci-dessous
  }
  return MESSAGES_PAR_STATUT[response.status] ?? `Erreur ${response.status}`
}

/**
 * Ce qui s'affiche quand la requête n'a même pas pu partir.
 *
 * `fetch` rejette avec un `TypeError: Failed to fetch` - serveur éteint, réseau
 * coupé, DNS muet, CORS refusé. Ce message est celui du NAVIGATEUR : anglais,
 * technique, et il s'affichait tel quel au milieu d'une interface entièrement
 * en français (constaté sur « Bilan annuel », qui rendait « Failed to fetch »
 * là où l'écran attendait un bilan).
 *
 * La traduction des statuts HTTP existait déjà (voir MESSAGES_PAR_STATUT), mais
 * elle suppose une RÉPONSE. Ici il n'y en a aucune : le cas passait entre les
 * mailles.
 */
const MESSAGE_HORS_LIGNE =
  "Impossible de joindre IozyCore. Vérifie que le serveur est démarré, puis réessaie."

/**
 * Le jeton anti-CSRF, tel que le serveur vient de le déposer.
 *
 * <h2>Pourquoi ce va-et-vient</h2>
 * La session est un cookie, et un cookie part TOUT SEUL avec la requête - y
 * compris quand c'est une autre page qui la déclenche. C'est la définition
 * d'une CSRF. Le serveur dépose donc un second cookie, celui-ci LISIBLE par
 * le JavaScript de cette origine, qu'on lui renvoie en en-tête : une page
 * tierce ne peut pas le lire, donc pas forger l'en-tête.
 *
 * <p>Absent avant le tout premier appel (le serveur ne l'a pas encore posé) :
 * l'en-tête est alors simplement omis, et c'est le serveur qui tranche.
 */
function jetonCsrf(): string | undefined {
  const brut = document.cookie
    .split('; ')
    .find((morceau) => morceau.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length)
  return brut ? decodeURIComponent(brut) : undefined
}

/**
 * Ce qui est annoncé quand la session n'est plus valable.
 *
 * Un 401 peut tomber sur N'IMPORTE quel appel : session expirée, serveur
 * redémarré, déconnexion depuis un autre onglet. Plutôt que de laisser chaque
 * écran inventer sa réaction, le client l'annonce une fois, et l'écran de
 * connexion se remet en place de lui-même (voir lib/useAuth).
 */
export const EVENEMENT_SESSION_PERDUE = 'iozycore:session-perdue'

/**
 * Ce que lit quelqu'un qui visite une collection sans compte et appuie quand
 * même sur un bouton d'écriture.
 *
 * <h2>Pourquoi le refus est aussi ICI, alors que le serveur refuse déjà</h2>
 * Le serveur est la protection - lui seul l'est, et il refuse toute méthode
 * autre que GET à une session de visite (voir SecurityConfig). Ce garde-fou ne
 * protège rien : il RÉPOND. Une quarantaine de boutons d'écriture vivent dans
 * cette application, et masquer chacun d'eux dans chaque écran était la
 * garantie d'en oublier - et l'oubli, lui, se serait vu comme une erreur rouge
 * inexpliquée après un aller-retour réseau.
 *
 * <p>Posé au même endroit que le jeton CSRF, pour la même raison : c'est le
 * passage obligé de tout appel, y compris celui qu'on écrira dans six mois
 * sans se souvenir qu'un mode visiteur existe.
 */
export const MESSAGE_LECTURE_SEULE =
  'Tu visites cette collection en lecture seule. Il faut un compte pour y changer quoi que ce soit.'

/**
 * Annonce qu'une écriture vient d'être refusée parce qu'on visite.
 *
 * Le refus est levé comme une erreur, et chaque écran traite les siennes à sa
 * façon - certains les affichent en bannière, d'autres pas du tout. Or c'est
 * le seul cas où la « panne » n'en est pas une : elle est prévue, elle
 * s'explique en une phrase, et elle doit se lire quel que soit le bouton
 * pressé. L'annoncer une fois, ici, laisse un seul endroit la montrer (voir
 * lib/useRefusDeVisite) - même mécanique que la session perdue, juste au-dessus.
 */
export const EVENEMENT_ECRITURE_REFUSEE = 'iozycore:ecriture-refusee'

/**
 * Vrai pendant une visite sans compte. Une variable de module et non un
 * contexte React : `request` n'est pas un composant, et c'est justement pour
 * qu'AUCUN appel ne puisse passer à côté qu'il est le seul à décider (voir
 * lib/useAuth, qui la tient à jour).
 */
let visiteEnLectureSeule = false

export function declarerVisiteEnCours(actif: boolean) {
  visiteEnLectureSeule = actif
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  const methode = (init?.method ?? 'GET').toUpperCase()
  // `/auth/` reste ouvert : entrer en visite et en sortir sont des POST, et ce
  // sont les deux seuls gestes d'un visiteur qui doivent aboutir. Le serveur
  // fait exactement la même exception, pour ne pas enfermer quelqu'un dans une
  // collection qui n'est pas la sienne.
  if (visiteEnLectureSeule && methode !== 'GET' && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent(EVENEMENT_ECRITURE_REFUSEE))
    throw new ApiError(403, MESSAGE_LECTURE_SEULE)
  }
  const jeton = methode === 'GET' || methode === 'HEAD' ? undefined : jetonCsrf()
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      // La session voyage dans un cookie : sans ceci, un appel vers une autre
      // origine que la page (déploiement où l'app et l'API sont sur deux
      // domaines) partirait sans lui, donc en 401 - alors qu'on est connecté.
      credentials: 'include',
      headers: {
        // Surtout PAS sur un FormData : le navigateur doit poser lui-même
        // `multipart/form-data; boundary=…`, et l'écraser par `application/json`
        // rendrait le corps illisible côté serveur (415, sans indice).
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { 'X-XSRF-TOKEN': jeton } : {}),
        ...init?.headers,
      },
    })
  } catch (cause) {
    // Une annulation n'est PAS une panne : TanStack Query annule les requêtes
    // devenues obsolètes (recherche débouncée), et transformer cela en « serveur
    // injoignable » ferait clignoter une fausse erreur à chaque frappe.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    // 0 : aucune réponse n'a été reçue, il n'y a pas de statut à rapporter.
    throw new ApiError(0, MESSAGE_HORS_LIGNE)
  }

  if (!response.ok) {
    // La session a sauté : l'annoncer UNE fois, ici, plutôt que de laisser
    // chaque écran deviner ce que veut dire son 401. `/auth/me` est exclu -
    // c'est justement la question « suis-je connecté ? », et son 401 est une
    // réponse, pas un incident.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_PERDUE))
    }
    throw new ApiError(response.status, await extractErrorMessage(response))
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  return (await response.json()) as T
}

/** `signal` optionnel (passé par TanStack Query) - annule la requête HTTP
 * sous-jacente si elle devient obsolète avant d'avoir répondu (voir
 * QuickAddPage, recherche de métadonnées débouncée). */
export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal })
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
}

/**
 * POST d'un formulaire multipart - le seul cas où l'on envoie autre chose que
 * du JSON : des fichiers. En base64 dans un corps JSON, trois photos gonflent
 * d'un tiers et se parsent d'un bloc en mémoire.
 */
export function postForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: form })
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

/** Construit une query string en omettant les paramètres null/undefined/"". */
export function buildQuery(params: Record<string, string | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries as [string, string][]).toString()
}
