import { get, patch, post } from './client'

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
  /**
   * What the account chose for both apps (lot 218). Given by `GET` and
   * `PATCH /auth/me` only: absent from the sign-in answers and for a visit
   * ("not said here"). A null field inside means "never chosen on the
   * account": the device keeps its own setting.
   */
  preferences?: PreferencesCompte | null
}

/** The accent: the colors of the cover on screen, or the brand terracotta. */
export type AccentCompte = 'AUTO' | 'TERRACOTTA'
export type ApparenceCompte = 'SYSTEM' | 'DARK' | 'LIGHT'
export type LangueTitreCompte = 'FRENCH' | 'ENGLISH' | 'ROMAJI'

export interface PreferencesCompte {
  accent: AccentCompte | null
  appearance: ApparenceCompte | null
  /** The three title languages, in order, each on or off. */
  titleComposition: { language: LangueTitreCompte; enabled: boolean }[] | null
  /** The IozyTest sound effects: on or off, and the volume from 0 to 100. */
  blindtestSound: { enabled: boolean; volume: number } | null
}

/** A change of the profile: only the fields named change. */
export interface ModificationCompte {
  pseudo?: string
  preferences?: Partial<PreferencesCompte>
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

/**
 * Changes the pseudo and/or the preferences of the signed-in account (lot
 * 218). A bad or taken pseudo is refused with its reason (400).
 */
export function modifierCompte(modification: ModificationCompte): Promise<Compte> {
  return patch<Compte>('/auth/me', modification)
}
