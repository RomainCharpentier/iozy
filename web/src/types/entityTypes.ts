// Les types sont désormais dynamiques (éditeur de types, GET /api/entity-types
// via src/api/entityTypes.ts) - plus de constantes codées en dur ici. Voir
// EntityTypeDto dans types/api.ts pour la forme exacte (miroir du backend).
//
// CONDITIONS/CONDITION_LABELS/OWNERSHIP_STATUS_LABELS/RELATIONSHIP_TYPE_PRESETS
// restent ici : ce ne sont pas des données par type (domaine-wide), rien à
// changer pour elles.
import type { EntityTypeDto } from './api'

/** Résout un type par son code bien connu (ex: "MANGA", "BOARD_GAME") - utilisé
 * pour les comportements intentionnellement câblés sur un type précis
 * (lookup code-barres, import BGG, sections de découverte), jamais
 * généralisés à des types créés par l'utilisateur. */
export function findEntityTypeByCode(types: EntityTypeDto[], code: string): EntityTypeDto | undefined {
  return types.find((t) => t.code === code)
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

/** Le libellé d'un type prédéfini, ou le type brut s'il a été saisi librement -
 * on n'invente pas de traduction pour un texte de l'utilisateur. */
export function relationshipTypeLabel(value: string): string {
  return RELATIONSHIP_TYPE_PRESETS.find((preset) => preset.value === value)?.label ?? value
}
