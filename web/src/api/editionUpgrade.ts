import { del, get, post } from './client'
import { buildQuery } from './client'
import type {
  CreateEditionUpgradeWishRequest,
  EditionUpgradeWishDto,
  EnrichedEditionUpgradeWishDto,
} from '../types/editionUpgrade'

export function createEditionUpgradeWish(body: CreateEditionUpgradeWishRequest): Promise<EditionUpgradeWishDto> {
  return post<EditionUpgradeWishDto>('/edition-upgrade-wishes', body)
}

export function deleteEditionUpgradeWish(id: string): Promise<void> {
  return del<void>(`/edition-upgrade-wishes/${id}`)
}

export function listEditionUpgradeWishesForEntity(entityId: string): Promise<EditionUpgradeWishDto[]> {
  return get<EditionUpgradeWishDto[]>(`/edition-upgrade-wishes${buildQuery({ entityId })}`)
}

/** Toutes les envies d'amélioration ("Mon profil"), enrichies du titre de la série. */
export function listAllEditionUpgradeWishes(): Promise<EnrichedEditionUpgradeWishDto[]> {
  return get<EnrichedEditionUpgradeWishDto[]>('/edition-upgrade-wishes/all')
}
