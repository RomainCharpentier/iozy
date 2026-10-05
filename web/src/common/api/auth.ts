import { get, post } from './client'

/**
 * Sign in, sign out, know who you are.
 *
 * <p>No token is handled here: the session lives in a cookie that the
 * browser sends by itself and that JavaScript cannot read (see
 * SecurityConfig on the server side). So this module only asks questions
 * to the server - it is the one that knows.
 */

/** The state of an instance, to know what to offer before even knowing anyone. */
export interface EtatAuth {
  /** Nobody has an account yet: this is the very first start. */
  aucunCompte: boolean
  /** One more account can be created (first account, or an invitation code is configured). */
  creationOuverte: boolean
}

export interface Compte {
  /** Null in a visit: a visitor is nobody, there is no account to name. */
  id: string | null
  /** Null in a visit: a visitor has no address. */
  email: string | null
  /** Unique on the instance, and the only name under which one appears - never the address. */
  pseudo: string
  /**
   * Can administer the INSTANCE - see who has an account, delete one.
   * No access to anyone's data: isolation by owner is
   * complete (see `api/admin`).
   */
  admin: boolean
  /**
   * A VISIT, not an account. The session then names no owner:
   * it sees the catalog - the works, which belong to nobody - and
   * nothing of anyone's ownerships, ratings or wishes. Every write
   * is refused (403).
   */
  invite: boolean
}

export function lireEtatAuth(): Promise<EtatAuth> {
  return get<EtatAuth>('/auth/etat')
}

/** The signed-in account. Rejects with 401 when there is none - this is not a failure. */
export function lireCompte(): Promise<Compte> {
  return get<Compte>('/auth/me')
}

export function seConnecter(email: string, motDePasse: string): Promise<Compte> {
  return post<Compte>('/auth/login', { email, motDePasse })
}

export function creerCompte(params: {
  email: string
  motDePasse: string
  pseudo: string
  codeInvitation?: string
}): Promise<Compte> {
  return post<Compte>('/auth/register', params)
}

export function seDeconnecter(): Promise<void> {
  return post<void>('/auth/logout')
}

/**
 * Browse the catalog without an account. Always possible: there is no
 * setting to check, and nothing to authorize.
 */
export function entrerEnVisite(): Promise<Compte> {
  return post<Compte>('/auth/visite')
}
