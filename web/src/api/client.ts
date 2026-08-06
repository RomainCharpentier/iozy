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

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.error === 'string') return body.error
  } catch {
    // pas de corps JSON exploitable, on retombe sur statusText plus bas
  }
  return response.statusText || `Erreur ${response.status}`
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

export function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined })
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined })
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
