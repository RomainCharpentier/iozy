import { coverImageUrlFrom } from '../../lib/coverImage'
import type { EntityResponse, EntityTypeDto } from '../../types/api'
import type { MangaEditionDto } from '../../types/purchaseAnalysis'

export interface ShelfTile {
  key: string
  title: string
  subtitle: string
  imageUrl: string | null
  gradientKey?: string
  entityId: string
  signal?: string
}

/** Même ordre que la maquette V1.2 (const ORDER : manga, jv, jds, puis le
 * reste) - les codes non listés ici (un type créé plus tard via
 * Administration) suivent à la fin, jamais masqués. */
const TYPE_ORDER = ['MANGA', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK']

function formatTomeCount(count: number): string {
  return `${count} tome${count > 1 ? 's' : ''}`
}

/**
 * Index (Série + édition) -> nombre total de tomes de CETTE édition, construit
 * une fois pour tout l'écran à partir du référentiel d'éditions.
 * <p>
 * C'est la même source que la fiche, l'assistant et la page publique : la
 * complétude se calcule TOUJOURS par édition, jamais au niveau de la série
 * (deux éditions n'ont pas le même nombre de tomes - voir CollectionStatus
 * côté backend). Ma collection utilisait jusqu'ici l'attribut `totalVolumes`
 * de la Série, fourni par MyAnimeList : les deux écrans se contredisaient sur
 * les mêmes données ("1 tome" ici contre "1/6" sur la fiche pour Death Note,
 * et l'inverse pour une série sans édition renseignée). Alignement demandé par
 * l'utilisateur le 2026-08-20.
 */
export function indexEditionTotals(editions: MangaEditionDto[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const edition of editions) {
    if (edition.entityId && edition.totalVolumes !== null) {
      index.set(editionTotalKey(edition.entityId, edition.editionName), edition.totalVolumes)
    }
  }
  return index
}

function editionTotalKey(entityId: string, editionName: string): string {
  return `${entityId}|${editionName.trim().toLowerCase()}`
}

/** Total de tomes de l'édition possédée - null quand la série mélange
 * plusieurs éditions (rien à totaliser sans savoir laquelle) ou quand
 * l'édition n'a pas de fiche de référence renseignée. Jamais un repli sur le
 * total de la série : ce serait exactement l'incohérence qu'on retire. */
function editionTotalFor(entity: EntityResponse, editionTotals: Map<string, number>): number | null {
  const edition = singleNamedEdition(entity)
  if (edition === null) return null
  return editionTotals.get(editionTotalKey(entity.id, edition)) ?? null
}

function singleNamedEdition(entity: EntityResponse): string | null {
  const names = new Set(
    entity.variants
      .map((v) => (typeof v.attributes.edition === 'string' ? v.attributes.edition.trim() : ''))
      .filter((name) => name !== ''),
  )
  return names.size === 1 ? [...names][0] : null
}

/** "Plus que 2 tomes" - seul signal implémenté pour l'instant (voir "un seul
 * signal par carte" + la maquette, qui cite cet exemple mot pour mot).
 * Réutilise exactement le même calcul que Suggestions d'achats (séries
 * presque complètes) plutôt qu'une nouvelle règle inventée ici. D'autres
 * signaux potentiels (envie/tier/sortie) restent BLOCKED_BY_DATA - voir
 * docs/DESIGN_MIGRATION_V1.2.md - ajoutés plus tard avec un vrai ordre de
 * priorité entre eux, jamais empilés. */
function nearCompletionSignal(missing: number): string | undefined {
  return missing > 0 && missing <= 3 ? `Plus que ${formatTomeCount(missing)}` : undefined
}

export function buildShelfTile(entity: EntityResponse, owned: Set<string>, editionTotals: Map<string, number>): ShelfTile {
  if (entity.variants.length === 0) {
    return {
      key: entity.id,
      title: entity.title,
      subtitle: 'Possédé',
      imageUrl: coverImageUrlFrom(entity.attributes),
      entityId: entity.id,
    }
  }
  const ownedCount = entity.variants.filter((v) => owned.has(v.id)).length
  const total = editionTotalFor(entity, editionTotals)
  const countPart = total !== null ? `${ownedCount}/${total} tomes` : formatTomeCount(ownedCount)
  const edition = singleNamedEdition(entity)
  return {
    key: entity.id,
    title: entity.title,
    subtitle: edition ? `${edition} · ${countPart}` : countPart,
    imageUrl: coverImageUrlFrom(entity.attributes),
    entityId: entity.id,
    signal: total !== null ? nearCompletionSignal(total - ownedCount) : undefined,
  }
}

/** null = complétude inconnue (pas de tome, éditions mélangées, ou édition
 * sans fiche de référence renseignée) - jamais devinée, voir isSeriesOngoing
 * pour le même principe. Interne : seul `matchesCompletionFilter` ci-dessous
 * s'en sert. */
function isComplete(entity: EntityResponse, owned: Set<string>, editionTotals: Map<string, number>): boolean | null {
  if (entity.variants.length === 0) return null
  const total = editionTotalFor(entity, editionTotals)
  if (total === null) return null
  return entity.variants.filter((v) => owned.has(v.id)).length >= total
}

export type CompletionFilter = 'ALL' | 'INCOMPLETE' | 'COMPLETE'

/** Une entité sans complétude connue (isComplete === null) ne correspond à
 * AUCUN filtre d'état sauf "Toutes" - jamais classée par défaut d'un côté
 * ou de l'autre faute de donnée réelle. */
export function matchesCompletionFilter(
  entity: EntityResponse,
  owned: Set<string>,
  filter: CompletionFilter,
  editionTotals: Map<string, number>,
): boolean {
  if (filter === 'ALL') return true
  const complete = isComplete(entity, owned, editionTotals)
  if (complete === null) return false
  return filter === 'COMPLETE' ? complete : !complete
}

/** Regroupe les entités possédées par type, dans l'ordre de la maquette,
 * SANS les types à 0 titre (voir la maquette V1.2 - `sections.filter(s =>
 * s.tiles.length > 0)`, jamais un rail vide qui n'aurait rien à faire
 * défiler). */
export function groupByEntityType(
  entities: EntityResponse[],
  entityTypes: EntityTypeDto[],
  owned: Set<string>,
  editionTotals: Map<string, number>,
): { entityType: EntityTypeDto; tiles: ShelfTile[] }[] {
  const sorted = [...entityTypes].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a.code)
    const ib = TYPE_ORDER.indexOf(b.code)
    return (ia === -1 ? TYPE_ORDER.length : ia) - (ib === -1 ? TYPE_ORDER.length : ib)
  })
  return sorted
    .map((entityType) => ({
      entityType,
      tiles: entities
        .filter((e) => e.entityTypeId === entityType.id)
        .map((e) => buildShelfTile(e, owned, editionTotals)),
    }))
    .filter((section) => section.tiles.length > 0)
}
