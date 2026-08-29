import { del, get } from './client'

/**
 * L'administration de l'INSTANCE : qui a un compte, et en supprimer un.
 *
 * <p>Réservé aux comptes administrateurs (`compte.admin`, voir `api/auth`) —
 * mais c'est le <b>serveur</b> qui l'impose : tout `/api/admin/**` répond 403
 * sans le rôle. Ce que l'écran fait de `compte.admin`, c'est éviter de proposer
 * une porte fermée, jamais protéger quoi que ce soit.
 *
 * <p>Rien ici ne donne accès aux données de qui que ce soit : des
 * métadonnées, et des nombres.
 */

/** Ce que pèse un compte — ce qu'on détruirait en le supprimant. */
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
  /** ISO 8601, tel que le serveur l'écrit. */
  creeLe: string
  volume: VolumeDuCompte
}

export function listerComptes(): Promise<CompteAdministre[]> {
  return get<CompteAdministre[]>('/admin/comptes')
}

/**
 * Supprime un compte et **toutes** ses données. Définitif, sans reprise.
 *
 * <p>409 quand l'administrateur vise son propre compte : le serveur le refuse,
 * et c'est ce qui garantit qu'il reste toujours quelqu'un pour administrer.
 */
export function supprimerCompte(id: string): Promise<void> {
  return del<void>(`/admin/comptes/${id}`)
}
