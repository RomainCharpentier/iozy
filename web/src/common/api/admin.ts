import { del, get } from './client'

/**
 * Administration of the INSTANCE: who has an account, and deleting one.
 *
 * <p>Reserved for administrator accounts (`compte.admin`, see `api/auth`) -
 * but it is the <b>server</b> that enforces it: every `/api/admin/**` answers 403
 * without the role. What the screen does with `compte.admin` is avoid offering
 * a closed door, never protect anything.
 *
 * <p>Nothing here gives access to anyone's data: only
 * metadata, and numbers.
 */

/** What an account weighs - what would be destroyed by deleting it. */
export interface VolumeDuCompte {
  possessions: number
  envies: number
  experiences: number
  classements: number
  analyses: number
  total: number
}

export interface CompteAdministre {
  id: string
  pseudo: string
  email: string
  admin: boolean
  /** ISO 8601, as the server writes it. */
  creeLe: string
  volume: VolumeDuCompte
}

export function listerComptes(): Promise<CompteAdministre[]> {
  return get<CompteAdministre[]>('/admin/comptes')
}

/**
 * Deletes an account and **all** its data. Final, no recovery.
 *
 * <p>409 when the administrator targets their own account: the server refuses it,
 * and this guarantees that someone always remains to administer.
 */
export function supprimerCompte(id: string): Promise<void> {
  return del<void>(`/admin/comptes/${id}`)
}
