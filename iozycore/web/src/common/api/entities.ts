import { get, post, patch, del, buildQuery } from './client'
import type { EntityResponse, QuickAddRequest, QuickAddResponse } from '@/common/types/api'

export function quickAdd(body: QuickAddRequest): Promise<QuickAddResponse> {
  return post<QuickAddResponse>('/entities/quick-add', body)
}

export function getEntity(id: string): Promise<EntityResponse> {
  return get<EntityResponse>(`/entities/${id}`)
}

/** q/entityTypeId/tagId are all optional - with none, returns everything
 * (used by the Shelf screen as the "full list"). */
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

/** Where what we write comes from (Batch 130): what the user types is
 * marked "typed by hand"; what a source returns only overwrites the rest. */
export type OrigineAttributs = 'manuelle' | 'source'

/** Completes/corrects the attributes of the Series itself - same pattern as
 * mergeVariantAttributes, at the Entity level rather than a nested Variant.
 * `origine` tells the server whether the user or a source is writing:
 * it is THE SERVER that holds the rule "we do not overwrite what was typed",
 * so that it applies from any screen. */
export function mergeEntityAttributes(
  entityId: string,
  attributes: Record<string, unknown>,
  origine: OrigineAttributs = 'manuelle',
): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}?origine=${origine}`, attributes)
}

/** Removes an attribute - distinct from mergeEntityAttributes, which can only
 * complete/correct: an empty value there would be stored as is and
 * would then look like filled-in data (see Entity.mergeAttributes
 * on the backend side). */
export function removeEntityAttribute(entityId: string, key: string): Promise<void> {
  return del<void>(`/entities/${entityId}/attributes/${encodeURIComponent(key)}`)
}

/** Renames the Series (manual correction, "Edit" mode of the Series
 * detail page) - never breaks the Editions/Volumes already attached (see migration
 * "Series -> Edition by ID": their link goes through entityId, never through a
 * title match). */
export function renameEntity(entityId: string, title: string): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}/rename`, { title })
}

/** Completes the attributes of an existing Variant without overwriting those already
 * filled in (e.g. cover of the volume found afterwards, see "Retrouver
 * les jaquettes manquantes" on Ma collection). */
export function mergeVariantAttributes(
  entityId: string,
  variantId: string,
  attributes: Record<string, unknown>,
): Promise<EntityResponse> {
  return patch<EntityResponse>(`/entities/${entityId}/variants/${variantId}`, attributes)
}
