import { coverImageUrlFrom } from '@/common/lib/coverImage'
import { isOwned } from '@/common/lib/ownership'
import type { FiltreCollection } from '@/common/lib/preferencesCollection'
import type {
  CollectionProgressDto,
  EditionProgressDto,
  EntityResponse,
  EntityTypeDto,
  OwnershipResponse,
  VariantDto,
} from '@/common/types/api'
import { editionDe, numeroDe } from '@/common/lib/attributsTome'

export interface ShelfTile {
  key: string
  title: string
  subtitle: string
  imageUrl: string | null
  gradientKey?: string
  entityId: string
  signal?: string
}

function formatTomeCount(count: number): string {
  return `${count} tome${count > 1 ? 's' : ''}`
}

/**
 * The progress computed BY THE SERVER, indexed by work.
 *
 * <h2>Read, rather than recompute</h2>
 * This screen used to derive its own progress from an editions reference and a
 * home-made `singleNamedEdition`. The server exposes exactly the same thing
 * (`GET /insights/progress`), with one more rule: a cataloged volume WITHOUT a
 * specified edition joins the single named edition of the series. Recomputing on
 * its own side has already produced two documented divergences - a series announced
 * 2/72 here and 3/72 there (batch 31), then a purchase analysis advising to
 * buy again a volume already owned (batch 49). The rule now lives in a single
 * place, and this screen consumes it.
 */
export function indexerProgression(progressions: CollectionProgressDto[]): Map<string, CollectionProgressDto> {
  return new Map(progressions.map((progression) => [progression.entityId, progression]))
}

/** The edition that represents a work in a list - the one the server
 *  kept. `null` for a work without volumes (video game, board game). */
function editionRepresentative(
  entity: EntityResponse,
  progression: Map<string, CollectionProgressDto>,
): EditionProgressDto | null {
  return progression.get(entity.id)?.dominantEdition ?? null
}

/** "Plus que 2 tomes" - the only signal implemented for now (see "one single
 * signal per card" + the mockup, which quotes this example word for word).
 * Reuses exactly the same computation as Purchase suggestions (almost
 * complete series) rather than a new rule invented here. Other potential
 * signals (wish/tier/release) stay BLOCKED_BY_DATA - see
 * docs/DESIGN_MIGRATION_V1.2.md - added later with a real order of
 * priority between them, never stacked. */
function nearCompletionSignal(missing: number): string | undefined {
  return missing > 0 && missing <= 3 ? `Plus que ${formatTomeCount(missing)}` : undefined
}

/**
 * The card of a SERIES in the grouped view.
 *
 * `envie` describes what the group contains that is wished. Without it, a series
 * that is wanted without owning a single volume of it announced "0 tome": an
 * ownership count placed on a card that is only there because it is
 * wanted. And under the "Envies" filter, the number of wished volumes is
 * THE relevant signal - it then takes priority over "Plus que 2 tomes", to
 * respect the rule of one single signal per card, never stacked.
 */
export function buildShelfTile(
  entity: EntityResponse,
  progression: Map<string, CollectionProgressDto>,
  envie: { possede: boolean; suivi?: boolean; tomesVoulus: number; prioritaire: boolean } = {
    possede: true,
    tomesVoulus: 0,
    prioritaire: false,
  },
): ShelfTile {
  const signalEnvie =
    envie.tomesVoulus > 0 ? `${envie.tomesVoulus} tome${envie.tomesVoulus > 1 ? 's' : ''} voulu${envie.tomesVoulus > 1 ? 's' : ''}` : undefined

  if (entity.variants.length === 0) {
    // A type without volumes: the work IS the object, it is therefore owned or
    // wished - the volume count means nothing here.
    return {
      key: entity.id,
      title: entity.title,
      subtitle: envie.possede ? 'Possédé' : envie.suivi ? 'Suivie' : 'Dans mes envies',
      imageUrl: coverImageUrlFrom(entity.attributes),
      entityId: entity.id,
    }
  }
  // The count comes from the server: it includes the volumes without a specified edition
  // attached to this edition, which the local computation here forgot.
  const editionAffichee = editionRepresentative(entity, progression)
  const ownedCount = editionAffichee ? editionAffichee.ownedVolumeNumbers.length : 0
  const total = editionAffichee?.totalVolumes ?? null
  const countPart =
    ownedCount === 0 ? 'aucun tome encore' : total !== null ? `${ownedCount}/${total} tomes` : formatTomeCount(ownedCount)
  const edition = editionAffichee && editionAffichee.editionName !== '' ? editionAffichee.editionName : null
  return {
    key: entity.id,
    title: entity.title,
    // The count first: on a shelf with three columns, the subtitle is
    // cut, and it is "4/43 tomes" that must be read, not the publisher name.
    subtitle: edition ? `${countPart} · ${edition}` : countPart,
    imageUrl: coverImageUrlFrom(entity.attributes),
    entityId: entity.id,
    signal:
      envie.prioritaire && signalEnvie
        ? signalEnvie
        : total !== null
          ? (nearCompletionSignal(total - ownedCount) ?? signalEnvie)
          : signalEnvie,
  }
}

/** null = unknown completeness (no volume, mixed editions, or edition
 * without a filled reference sheet) - never guessed, see isSeriesOngoing
 * for the same principle. Internal: only `matchesCompletionFilter` below
 * uses it. */
function isComplete(entity: EntityResponse, progression: Map<string, CollectionProgressDto>): boolean | null {
  const editionAffichee = editionRepresentative(entity, progression)
  if (!editionAffichee || editionAffichee.totalVolumes === null) return null
  return editionAffichee.ownedVolumeNumbers.length >= editionAffichee.totalVolumes
}

export type CompletionFilter = 'ALL' | 'INCOMPLETE' | 'COMPLETE'

/** An entity without known completeness (isComplete === null) matches
 * NO state filter except "Toutes" - never classified by default on one side
 * or the other for lack of real data. */
export function matchesCompletionFilter(
  entity: EntityResponse,
  filter: CompletionFilter,
  progression: Map<string, CollectionProgressDto>,
): boolean {
  if (filter === 'ALL') return true
  const complete = isComplete(entity, progression)
  if (complete === null) return false
  return filter === 'COMPLETE' ? complete : !complete
}

/** How many TITLES each type counts in this collection - what decides the order of the rails. */
export function compterLesTitresParType(entities: EntityResponse[]): Map<string, number> {
  const titres = new Map<string, number>()
  for (const entity of entities) {
    titres.set(entity.entityTypeId, (titres.get(entity.entityTypeId) ?? 0) + 1)
  }
  return titres
}

/**
 * The order of the rails: the type with the most titles first, then by label.
 *
 * <h2>Why the data, and not a list of codes</h2>
 * The order was written in the code - manga, video game, board game, then
 * the rest - that is the starting universe first, whatever one
 * collects. My collection belongs to the core (batch 136): what one
 * collects the most comes first, and a category created tomorrow is
 * placed like the others. On a tie, the label - an order that can be
 * predicted, never the order in which the server returns them.
 *
 * <p>Counted in TITLES, and shared by BOTH views: grouping then ungrouping
 * must not change the order in which the universes scroll, while
 * three series of twenty volumes weigh more than ten games once
 * ungrouped.
 */
export function ordonnerLesTypes(entityTypes: EntityTypeDto[], titresParType: Map<string, number>): EntityTypeDto[] {
  return [...entityTypes].sort(
    (a, b) =>
      (titresParType.get(b.id) ?? 0) - (titresParType.get(a.id) ?? 0) || a.label.localeCompare(b.label, 'fr'),
  )
}

/** Groups the kept works by type, WITHOUT the types with 0 titles (never an
 *  empty rail that would have nothing to scroll), in the order of
 *  `ordonnerLesTypes` - counted on `titresParType` when the caller gives it
 *  (the whole collection, before the filter), on the received works otherwise. */
export function groupByEntityType(
  entities: EntityResponse[],
  entityTypes: EntityTypeDto[],
  progression: Map<string, CollectionProgressDto>,
  envieDe: (entity: EntityResponse) => { possede: boolean; tomesVoulus: number; prioritaire: boolean } = () => ({
    possede: true,
    tomesVoulus: 0,
    prioritaire: false,
  }),
  titresParType: Map<string, number> = compterLesTitresParType(entities),
): { entityType: EntityTypeDto; tiles: ShelfTile[] }[] {
  return ordonnerLesTypes(entityTypes, titresParType)
    .map((entityType) => ({
      entityType,
      tiles: entities
        .filter((e) => e.entityTypeId === entityType.id)
        .map((e) => buildShelfTile(e, progression, envieDe(e))),
    }))
    .filter((section) => section.tiles.length > 0)
}

// ---------------------------------------------------------------------------
// Three filters, two views (product study of 2026-08-27, sections 5 and 6)
// ---------------------------------------------------------------------------

/**
 * The personal state of a work, summarized for filtering.
 *
 * A work is here only a GROUP: it is the items it contains that
 * carry the state. "Possédée" means "at least one owned item", and
 * "voulue" "at least one item in the wishes" - never a state of its own to
 * the work, which has none.
 *
 * <p>For a type without variants (video game, board game), the work IS
 * the collectible item: ownership is attached to the Entity, and
 * the wish too (see lib/typeDeCollection).
 */
interface EtatOeuvre {
  possede: boolean
  voulu: boolean
  /** Followed: the third state, the one that puts the work on the release calendar. */
  suivi: boolean
}

const AUCUNE_SUIVIE: Set<string> = new Set()

export function etatDeLOeuvre(
  entity: EntityResponse,
  ownerships: OwnershipResponse[],
  owned: Set<string>,
  tomesVoulus: Set<string>,
  oeuvresVoulues: Set<string>,
  oeuvresSuivies: Set<string> = AUCUNE_SUIVIE,
): EtatOeuvre {
  return {
    possede: isOwned(entity, ownerships, owned),
    suivi: oeuvresSuivies.has(entity.id),
    voulu:
      oeuvresVoulues.has(entity.id) || entity.variants.some((variant) => tomesVoulus.has(variant.id)),
  }
}

export function correspondAuFiltre(etat: EtatOeuvre, filtre: FiltreCollection): boolean {
  if (filtre === 'possedes') return etat.possede
  if (filtre === 'envies') return etat.voulu
  if (filtre === 'suivies') return etat.suivi
  return etat.possede || etat.voulu || etat.suivi
}

/**
 * An ITEM, as the UNGROUPED view shows it: the individual object, taken out
 * of the group that only served to store it. A volume for a manga, the work
 * itself for a type that is owned as a single piece.
 *
 * `etat` is what tells apart two tiles of the same group under the
 * "Tout" filter - without it, a wished item and an owned item would
 * look exactly alike.
 */
export interface TuileElement extends ShelfTile {
  etat: 'possede' | 'voulu' | 'suivi'
  /** The type carries the cover format (2/3 for a manga, square for a
   *  board game): without it, the flat grid would mix the frames. */
  entityTypeId: string
  /** Date of the acquisition or of the wish - what the "recent" sort is based on. */
  depuis: string
}

function libelleDeLElement(variant: VariantDto): string {
  const numero = numeroDe(variant)
  const edition = editionDe(variant)
  const base = numero !== null ? `Tome ${numero}` : variant.label
  return edition ? `${base} · ${edition}` : base
}

/**
 * Flattens the kept works into ITEM tiles.
 *
 * A work without variants (video game, board game) gives a single tile,
 * itself: it is already the individual object of its type, there is nothing to
 * flatten. A work with variants gives one per kept variant - volumes
 * for a manga, and the variant label for any other type.
 *
 * <p>Tiles do NOT carry their type: the section announces it
 * (see GrilleElements), and repeating it on each of the seventy-two tiles
 * of the same section would teach nothing.
 */
export function aplatirEnElements(
  entities: EntityResponse[],
  filtre: FiltreCollection,
  contexte: {
    ownerships: OwnershipResponse[]
    owned: Set<string>
    tomesVoulus: Set<string>
    oeuvresVoulues: Set<string>
    /** The followed works: a one-piece work that is followed without being owned is a "Suivie" tile. */
    oeuvresSuivies?: Set<string>
    /** Since when this item is owned, or wished - depending on what it is. */
    depuisTome: (variantId: string) => string
    depuisOeuvre: (entityId: string) => string
  },
): TuileElement[] {
  const tuiles: TuileElement[] = []
  for (const entity of entities) {
    if (entity.variants.length === 0) {
      const etat = isOwned(entity, ownershipsDe(entity, contexte.ownerships), contexte.owned)
        ? ('possede' as const)
        : contexte.oeuvresSuivies?.has(entity.id)
          ? ('suivi' as const)
          : ('voulu' as const)
      if (retenu(etat, filtre)) {
        tuiles.push({
          key: entity.id,
          title: entity.title,
          subtitle: etat === 'possede' ? 'Possédé' : etat === 'suivi' ? 'Suivie' : 'Dans mes envies',
          imageUrl: coverImageUrlFrom(entity.attributes),
          entityId: entity.id,
          entityTypeId: entity.entityTypeId,
          etat,
          depuis: contexte.depuisOeuvre(entity.id),
        })
      }
      continue
    }
    for (const variant of entity.variants) {
      const etat = contexte.owned.has(variant.id)
        ? ('possede' as const)
        : contexte.tomesVoulus.has(variant.id)
          ? ('voulu' as const)
          : null
      if (etat === null || !retenu(etat, filtre)) continue
      const sousTitre = libelleDeLElement(variant)
      tuiles.push({
        key: variant.id,
        title: entity.title,
        subtitle: sousTitre,
        imageUrl: coverImageUrlFrom(variant.attributes) ?? coverImageUrlFrom(entity.attributes),
        // Without a cover of its own for the volume, the fallback gradient would be the same
        // for the whole series: the subtitle makes it vary volume by volume.
        gradientKey: `${entity.title} ${sousTitre}`,
        entityId: entity.id,
        entityTypeId: entity.entityTypeId,
        etat,
        depuis: contexte.depuisTome(variant.id),
        signal: etat === 'voulu' ? 'Je le veux' : undefined,
      })
    }
  }
  return tuiles
}

function retenu(etat: 'possede' | 'voulu' | 'suivi', filtre: FiltreCollection): boolean {
  if (filtre === 'possedes') return etat === 'possede'
  if (filtre === 'envies') return etat === 'voulu'
  if (filtre === 'suivies') return etat === 'suivi'
  return true
}

/** The ownerships of THIS work - `isOwned` without a volume goes through the whole list,
 *  so give it only what concerns it. */
function ownershipsDe(entity: EntityResponse, ownerships: OwnershipResponse[]): OwnershipResponse[] {
  return ownerships.filter((o) => o.entityId === entity.id)
}
