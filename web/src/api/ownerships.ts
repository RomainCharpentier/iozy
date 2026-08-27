import { get, del, buildQuery } from './client'
import type { OwnershipResponse } from '../types/api'

export function listOwnerships(entityId: string): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>(`/ownerships${buildQuery({ entityId })}`)
}

/** Toutes les Ownership, tous types confondus - pour calculer une progression
 * réelle (possédé, pas juste catalogué) par série sans une requête par série
 * (voir Ma collection). */
export function listAllOwnerships(): Promise<OwnershipResponse[]> {
  return get<OwnershipResponse[]>('/ownerships')
}

/**
 * Suppression définitive d'un exemplaire. Le backend peut la refuser en 409 ;
 * son message est affiché tel quel.
 *
 * <h2>Le seul geste d'écriture qui reste ici</h2>
 * « Vendu », « perdu », « annuler », la note de l'exemplaire et le prix payé
 * avaient chacun leur fonction dans ce fichier - elles ont perdu leur écran aux
 * lots 53 à 55, et personne ne les appelait plus. Les routes serveur
 * correspondantes ont suivi, sauf `/sell` et `/lose` que le client iOS utilise
 * encore, et `/restore` qui les annule (voir OwnershipController).
 */
export function deleteOwnership(id: string): Promise<void> {
  return del<void>(`/ownerships/${id}`)
}
