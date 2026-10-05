// Minimal HTTP client, a bit like APIClient.swift on the iOS side: no extra
// abstraction layer, the api/*.ts modules call request()
// directly and are themselves called from the TanStack Query hooks of the
// screens.
//
// Error handling: the backend returns two different formats depending on the
// type of exception (see ApiExceptionHandler.java) -
//   - domain exceptions (409/400) -> { "error": "message" }
//   - ResponseStatusException (404, some 400) -> goes through the default
//     Spring formatter, which does NOT include the detailed message of the controller
//     as long as server.error.include-message=always is not set
//     (this is not the case in application.yml) - so these errors
//     come back with a generic text ("Not Found"), not the precise message.
// We try body.error first, otherwise we fall back on statusText.

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Fallback when the backend did not provide a usable message: statusText
// is then "Not Found"/"Forbidden", raw English displayed as it is in
// an interface entirely in French (seen on the detail page of a deleted
// work). We translate the statuses that a user can really
// meet, and we keep the code for the others.
const MESSAGES_PAR_STATUT: Record<number, string> = {
  400: "Requête invalide.",
  401: "Accès refusé.",
  403: "Accès refusé.",
  404: "Introuvable - cette donnée n'existe plus, ou le lien est erroné.",
  409: "Opération impossible dans l'état actuel.",
  500: "Erreur du serveur.",
  // 502/504: the application server does not answer BEHIND the web server. In
  // development (`npm run dev`) the call fails before it completes and falls into
  // MESSAGE_HORS_LIGNE; but the application as deployed goes through the
  // nginx of docker-compose, which answers itself, with a 502 - the most
  // ordinary failure of this application (API container not started yet, or
  // stopped). Without these two lines, the fallback displayed the English status
  // phrase, "Bad Gateway", in an interface entirely in French.
  502: "Le serveur de l'application ne répond pas - vérifiez qu'il est bien démarré.",
  503: "Service indisponible, réessayez dans un instant.",
  504: "Le serveur de l'application ne répond pas - vérifiez qu'il est bien démarré.",
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    // Trap: the generic Spring envelope ALSO carries an "error" field,
    // which does not contain a message there but the HTTP status phrase
    // ("Not Found"). Recognizing it by its shape (timestamp + status + path)
    // avoids displaying this raw English instead of the translated fallback.
    const enveloppeSpring = body && 'timestamp' in body && 'status' in body
    // Spring envelope: "error" only carries the status phrase, but
    // "message" carries the reason written by the controller when there is one
    // (server.error.include-message: always). Spring puts "No message
    // available" there when there is none - to ignore, the translated fallback
    // says things better.
    if (enveloppeSpring) {
      const raison = typeof body.message === 'string' ? body.message.trim() : ''
      // Except in 404: there, the message only names the missing identifier
      // ("Entity introuvable : 3f2a...-9c1e"), which tells the reader nothing.
      // The translated fallback says the only useful thing - the link leads
      // nowhere anymore. With the other statuses (409/400 mostly), the message IS the
      // actionable reason ("3 tome(s) y sont encore rattachés"): we display it.
      const utile = raison && raison !== 'No message available' && response.status !== 404
      if (utile) return raison
    } else if (typeof body?.error === 'string') {
      return body.error
    }
  } catch {
    // no usable JSON body, we fall back on the fallback below
  }
  return MESSAGES_PAR_STATUT[response.status] ?? `Erreur ${response.status}`
}

/**
 * What is displayed when the request could not even leave.
 *
 * `fetch` rejects with a `TypeError: Failed to fetch` - server off, network
 * cut, DNS silent, CORS refused. This message is the BROWSER's: English,
 * technical, and it was displayed as it is in the middle of an interface entirely
 * in French (seen on "Bilan annuel", which showed "Failed to fetch"
 * where the screen expected a recap).
 *
 * The translation of HTTP statuses already existed (see MESSAGES_PAR_STATUT), but
 * it assumes a RESPONSE. Here there is none: the case slipped through
 * the cracks.
 */
const MESSAGE_HORS_LIGNE =
  "Impossible de joindre IozyCore. Vérifie que le serveur est démarré, puis réessaie."

/**
 * The anti-CSRF token, as the server has just set it.
 *
 * <h2>Why this back and forth</h2>
 * The session is a cookie, and a cookie goes ALONG BY ITSELF with the request - even
 * when another page triggers it. This is the definition
 * of a CSRF. So the server sets a second cookie, this one READABLE by
 * the JavaScript of this origin, which we send back in a header: a
 * third-party page cannot read it, so cannot forge the header.
 *
 * <p>Absent before the very first call (the server has not set it yet):
 * the header is then simply omitted, and it is the server that decides.
 */
function jetonCsrf(): string | undefined {
  const brut = document.cookie
    .split('; ')
    .find((morceau) => morceau.startsWith('XSRF-TOKEN='))
    ?.slice('XSRF-TOKEN='.length)
  return brut ? decodeURIComponent(brut) : undefined
}

/**
 * What is announced when the session is no longer valid.
 *
 * A 401 can hit ANY call: expired session, restarted server, sign-out
 * from another tab. Rather than letting each screen invent its reaction, the
 * client announces it once, and the sign-in screen puts itself back
 * (see lib/useAuth).
 */
export const EVENEMENT_SESSION_PERDUE = 'iozycore:session-perdue'

/**
 * What someone reads who visits a collection without an account and presses
 * a write button anyway.
 *
 * <h2>Why the refusal is also HERE, when the server already refuses</h2>
 * The server is the protection - only it is, and it refuses every method
 * other than GET for a visit session (see SecurityConfig). This safeguard
 * protects nothing: it ANSWERS. About forty write buttons live in
 * this application, and hiding each of them in each screen was
 * a guarantee of forgetting some - and the omission would have shown up as an unexplained
 * red error after a network round trip.
 *
 * <p>Set in the same place as the CSRF token, for the same reason: it is
 * the required passage of every call, including the one that will be written in six months
 * without remembering that a visitor mode exists.
 */
export const MESSAGE_LECTURE_SEULE =
  'Tu visites cette collection en lecture seule. Il faut un compte pour y changer quoi que ce soit.'

/**
 * Announces that a write has just been refused because we are visiting.
 *
 * The refusal is thrown as an error, and each screen handles its own in its
 * own way - some display them in a banner, others not at all. Yet this is
 * the only case where the "failure" is not one: it is expected, it
 * is explained in one sentence, and it must be readable whatever the button
 * pressed. Announcing it once, here, leaves a single place to show it (see
 * lib/useRefusDeVisite) - same mechanism as the lost session, just above.
 */
export const EVENEMENT_ECRITURE_REFUSEE = 'iozycore:ecriture-refusee'

/**
 * True during a visit without an account. A module variable and not a
 * React context: `request` is not a component, and it is precisely so that
 * NO call can miss it that it is the only one to decide (see
 * lib/useAuth, which keeps it up to date).
 */
let visiteEnLectureSeule = false

export function declarerVisiteEnCours(actif: boolean) {
  visiteEnLectureSeule = actif
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  const methode = (init?.method ?? 'GET').toUpperCase()
  // `/auth/` stays open: entering a visit and leaving it are POSTs, and these
  // are the only two actions of a visitor that must succeed. The server
  // makes exactly the same exception, so as not to lock someone into a
  // collection that is not theirs.
  if (visiteEnLectureSeule && methode !== 'GET' && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent(EVENEMENT_ECRITURE_REFUSEE))
    throw new ApiError(403, MESSAGE_LECTURE_SEULE)
  }
  const jeton = methode === 'GET' || methode === 'HEAD' ? undefined : jetonCsrf()
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      // The session travels in a cookie: without this, a call to another
      // origin than the page (deployment where the app and the API are on two
      // domains) would leave without it, so it would get a 401 - while we are signed in.
      credentials: 'include',
      headers: {
        // Above all NOT on a FormData: the browser must set
        // `multipart/form-data; boundary=…` itself, and overwriting it with `application/json`
        // would make the body unreadable on the server side (415, with no clue).
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(jeton ? { 'X-XSRF-TOKEN': jeton } : {}),
        ...init?.headers,
      },
    })
  } catch (cause) {
    // A cancellation is NOT a failure: TanStack Query cancels requests
    // that became obsolete (debounced search), and turning this into "server
    // unreachable" would flash a false error at every keystroke.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    // 0: no response was received, there is no status to report.
    throw new ApiError(0, MESSAGE_HORS_LIGNE)
  }

  if (!response.ok) {
    // The session is gone: announce it ONCE, here, rather than letting
    // each screen guess what its 401 means. `/auth/me` is excluded -
    // it is precisely the question "am I signed in?", and its 401 is an
    // answer, not an incident.
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

/** Optional `signal` (passed by TanStack Query) - cancels the underlying
 * HTTP request if it becomes obsolete before it has answered (see
 * QuickAddPage, debounced metadata search). */
export function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal })
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
}

/**
 * POST of a multipart form - the only case where we send something other than
 * JSON: files. In base64 inside a JSON body, three photos grow
 * by a third and are parsed in one block in memory.
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

/** Builds a query string, leaving out the null/undefined/"" parameters. */
export function buildQuery(params: Record<string, string | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries as [string, string][]).toString()
}
