// Miroir de backend/src/main/java/com/iozycore/domain/catalog/EntityType.java
// et de ios/IozyCore/Models/EntityTypeMVP.swift. Pas d'endpoint backend pour
// lister les types d'entité (MVP à 3 types codés en dur) - donc codé en dur
// ici aussi, comme le fait déjà le client iOS.
export interface EntityTypeDef {
  id: string
  code: 'MANGA' | 'VIDEO_GAME' | 'BOARD_GAME'
  label: string
  allowedExperienceTypes: string[]
  customFieldKeys: string[]
}

export const MANGA: EntityTypeDef = {
  id: '00000000-0000-0000-0000-000000000001',
  code: 'MANGA',
  label: 'Manga',
  allowedExperienceTypes: ['READ', 'IN_PROGRESS', 'ABANDONED'],
  customFieldKeys: ['mangaka', 'publisher', 'volumeNumber', 'seriesStatus'],
}

export const VIDEO_GAME: EntityTypeDef = {
  id: '00000000-0000-0000-0000-000000000002',
  code: 'VIDEO_GAME',
  label: 'Jeu vidéo',
  allowedExperienceTypes: ['FINISHED', 'IN_PROGRESS', 'ABANDONED'],
  customFieldKeys: ['platform', 'studio', 'averageDurationHours'],
}

export const BOARD_GAME: EntityTypeDef = {
  id: '00000000-0000-0000-0000-000000000003',
  code: 'BOARD_GAME',
  label: 'Jeu de société',
  allowedExperienceTypes: ['PLAYED'],
  customFieldKeys: ['minPlayers', 'maxPlayers', 'averageDurationMinutes'],
}

export const ENTITY_TYPES: readonly EntityTypeDef[] = [MANGA, VIDEO_GAME, BOARD_GAME]

const BY_ID = new Map(ENTITY_TYPES.map((t) => [t.id, t]))

export function entityTypeById(id: string): EntityTypeDef | undefined {
  return BY_ID.get(id)
}

export const CONDITIONS = ['NEW', 'USED', 'DAMAGED'] as const
export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Neuf',
  USED: 'Occasion',
  DAMAGED: 'Abîmé',
}

export const OWNERSHIP_STATUS_LABELS: Record<string, string> = {
  OWNED: 'Possédé',
  SOLD: 'Vendu',
  LOST: 'Perdu',
}

export const RELATIONSHIP_TYPE_PRESETS = [
  { value: 'ADAPTED_INTO', label: 'Adapté en' },
  { value: 'PART_OF_SERIES', label: 'Fait partie de la série' },
  { value: 'RELATED_TO', label: 'Lié à' },
] as const
