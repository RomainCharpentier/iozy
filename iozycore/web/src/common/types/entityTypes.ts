// Types are now dynamic (type editor, GET /api/entity-types
// via src/api/entityTypes.ts) - no more hard-coded constants here. See
// EntityTypeDto in types/api.ts for the exact shape (mirror of the backend).
//
// CONDITIONS/CONDITION_LABELS/RELATIONSHIP_TYPE_PRESETS stay here: they are
// not per-type data (domain-wide), nothing to change for them.

export const CONDITIONS = ['NEW', 'USED', 'DAMAGED'] as const
export type Condition = (typeof CONDITIONS)[number]

export const CONDITION_LABELS: Record<Condition, string> = {
  NEW: 'Neuf',
  USED: 'Occasion',
  DAMAGED: 'Abîmé',
}

export const RELATIONSHIP_TYPE_PRESETS = [
  { value: 'ADAPTED_INTO', label: 'Adapté en' },
  { value: 'PART_OF_SERIES', label: 'Fait partie de la série' },
  { value: 'RELATED_TO', label: 'Lié à' },
] as const

/** The label of a predefined type, or the raw type if it was entered freely -
 * we do not invent a translation for a user text. */
export function relationshipTypeLabel(value: string): string {
  return RELATIONSHIP_TYPE_PRESETS.find((preset) => preset.value === value)?.label ?? value
}
