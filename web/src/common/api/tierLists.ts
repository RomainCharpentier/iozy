import { buildQuery, del, get, patch, post, put } from './client'
import type {
  CreateTierListRequest,
  EntityTierSummaryDto,
  GeneralBoardDto,
  Rank,
  TierListDetailDto,
  TierListDto,
  TierListEntryDto,
  UpdateTierListRequest,
} from '@/common/types/tierList'

// ═══ Classement général ═══

export function getGeneralBoard(entityTypeId: string): Promise<GeneralBoardDto> {
  return get<GeneralBoardDto>(`/tier-lists/general${buildQuery({ entityTypeId })}`)
}

/** `rank: null` déclasse l'œuvre ("non classé"). */
export function setGeneralRank(entityId: string, rank: Rank | null): Promise<TierListEntryDto> {
  return put<TierListEntryDto>(`/tier-lists/general/entities/${entityId}`, { rank })
}

export function getEntityTierSummary(entityId: string): Promise<EntityTierSummaryDto> {
  return get<EntityTierSummaryDto>(`/tier-lists/entities/${entityId}/summary`)
}

// ═══ Tier Lists personnalisées ═══

/** `entityTypeId` null = les Tier Lists transverses "toutes catégories" (voir
 * TierListController.byEntityType, paramètre omis), jamais toutes les listes confondues. */
export function listTierLists(entityTypeId: string | null): Promise<TierListDto[]> {
  return get<TierListDto[]>(`/tier-lists${buildQuery({ entityTypeId })}`)
}

export function createTierList(body: CreateTierListRequest): Promise<TierListDto> {
  return post<TierListDto>('/tier-lists', body)
}

export function getTierListDetail(id: string): Promise<TierListDetailDto> {
  return get<TierListDetailDto>(`/tier-lists/${id}`)
}

export function updateTierList(id: string, body: UpdateTierListRequest): Promise<TierListDto> {
  return patch<TierListDto>(`/tier-lists/${id}`, body)
}

export function deleteTierList(id: string): Promise<void> {
  return del<void>(`/tier-lists/${id}`)
}

export function addTierListItems(id: string, entityIds: string[]): Promise<TierListDetailDto> {
  return post<TierListDetailDto>(`/tier-lists/${id}/items`, { entityIds })
}

/** `rank: null` déclasse l'œuvre sans la retirer de la liste (reste "non classée"). */
export function setTierListItemRank(id: string, entityId: string, rank: Rank | null): Promise<TierListEntryDto> {
  return put<TierListEntryDto>(`/tier-lists/${id}/items/${entityId}`, { rank })
}

export function removeTierListItem(id: string, entityId: string): Promise<void> {
  return del<void>(`/tier-lists/${id}/items/${entityId}`)
}
