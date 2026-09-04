import { get, post, patch, del, buildQuery } from './client'
import type { EntityResponse, QuickAddRequest, QuickAddResponse } from '../types/api'

export function quickAdd(body: QuickAddRequest): Promise<QuickAddResponse> {
  return post<QuickAddResponse>('/entities/quick-add', body)
}

export function getEntity(id: string): Promise<EntityResponse> {
  return get<EntityResponse>(`/entities/${id}`)
}

/** q/entityTypeId/tagId sont tous optionnels - sans aucun, renvoie tout
 * (utilisé par l'écran Shelf comme "liste complète"). */
export function searchEntities(params: {
  q?: string
  entityTypeId?: string
  tagId?: string
}): Promise<EntityResponse[]> {
  return get<EntityResponse[]>(`/entities/search${buildQuery(params)}`)
}

export function deleteEntity(id: string): Promise<void> {
  return del<void>(`/entities/${id}`)
}

/** D'où vient ce qu'on écrit (Lot 130) : ce que l'utilisateur tape est
 * marqué « saisi à la main » ; ce qu'une source rend n'écrase que le reste. */
export type OrigineAttributs = 'manuelle' | 'source'

/** Complète/corrige les attributs de la Série elle-même - même patron que
 * mergeVariantAttributes, au niveau Entity plutôt qu'un Variant imbriqué.
 * `origine` dit au serveur si c'est l'utilisateur ou une source qui écrit :
 * c'est LUI qui tient la règle « on n'écrase pas ce qui a été saisi »,
 * pour qu'elle vaille depuis n'importe quel écran. */
export function mergeEntityAttributes(
  entityId: string,
  attributes: Record<string, unknown>,
  origine: OrigineAttributs = 'manuelle',
): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}?origine=${origine}`, attributes)
}

/** Retire un attribut - distinct de mergeEntityAttributes, qui ne sait que
 * compléter/corriger : une valeur vide y serait stockée telle quelle et
 * ressemblerait ensuite à une donnée renseignée (voir Entity.mergeAttributes
 * côté backend). */
export function removeEntityAttribute(entityId: string, key: string): Promise<void> {
  return del<void>(`/entities/${entityId}/attributes/${encodeURIComponent(key)}`)
}

/** Renomme la Série (correction manuelle, voir action "Modifier" de la fiche
 * Série) - ne casse jamais les Éditions/Tomes déjà rattachés (voir migration
 * "Série -> Édition par ID" : leur lien passe par entityId, jamais par une
 * égalité de titre). */
export function renameEntity(entityId: string, title: string): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}/rename`, { title })
}

/** Complète les attributs d'un Variant existant sans écraser ceux déjà
 * renseignés (ex: jaquette du tome retrouvée après coup, voir "Retrouver
 * les jaquettes manquantes" sur Ma collection). */
export function mergeVariantAttributes(
  entityId: string,
  variantId: string,
  attributes: Record<string, unknown>,
): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}/variants/${variantId}`, attributes)
}
