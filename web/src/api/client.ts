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
  503: "Service indisponible, réessayez dans un instant.",
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

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
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
