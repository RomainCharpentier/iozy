/**
 * The objects that the server returns, built in one line.
 *
 * <h2>Why builders rather than literals</h2>
 * `EntityResponse` carries six fields of which only one matters for a given
 * test. Written by hand, each case would drown its rule under five filler
 * fields - and the day the DTO gains one, all the tests have to be reopened.
 * Here, a test names ONLY what concerns it: `oeuvre({ titre: 'Berserk',
 * tomes: [tome(1)] })` reads like the sentence it checks.
 *
 * <p>The identifiers are derived from what is given (`tome-1`, `berserk`)
 * rather than drawn at random: a failing test then names the faulty object
 * instead of a UUID that nobody can link to anything.
 */
import type {
  CollectionProgressDto,
  EditionProgressDto,
  EntityResponse,
  EntityTypeDto,
  OwnershipResponse,
  TagDto,
  VariantDto,
} from '@/common/types/api'

/** A readable identifier: the title reduced to what can serve as a key. */
function idDe(valeur: string): string {
  return valeur.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function tome(
  numero: number | null,
  options: { edition?: string; libelle?: string; jaquette?: string } = {},
): VariantDto {
  const attributes: Record<string, unknown> = {}
  if (numero !== null) attributes.volumeNumber = numero
  if (options.edition !== undefined) attributes.edition = options.edition
  if (options.jaquette !== undefined) attributes.coverImageUrl = options.jaquette
  return {
    id: `tome-${numero ?? idDe(options.libelle ?? 'sans-numero')}`,
    label: options.libelle ?? `Tome ${numero}`,
    attributes,
    mangaEditionId: null,
  }
}

export function oeuvre(options: {
  titre: string
  typeId?: string
  tomes?: VariantDto[]
  jaquette?: string
  tags?: string[]
}): EntityResponse {
  return {
    id: idDe(options.titre),
    entityTypeId: options.typeId ?? 'type-manga',
    title: options.titre,
    attributes: options.jaquette !== undefined ? { coverImageUrl: options.jaquette } : {},
    tagIds: options.tags ?? [],
    variants: options.tomes ?? [],
    champsSaisis: [],
  }
}

/** A tag, as `GET /tags` returns it. */
export function tag(label: string): TagDto {
  return { id: idDe(label), label }
}

/** An ownership, active unless stated otherwise - this is the common case. */
export function possession(options: {
  entityId: string
  variantId?: string
  statut?: OwnershipResponse['status']
  acquiseLe?: string
}): OwnershipResponse {
  return {
    id: `possession-${options.variantId ?? options.entityId}`,
    entityId: options.entityId,
    variantId: options.variantId ?? null,
    condition: 'VERY_GOOD',
    status: options.statut ?? 'OWNED',
    acquiredAt: options.acquiseLe ?? '2026-01-15',
    note: null,
    purchasePrice: null,
  }
}

/**
 * An edition as `GET /insights/progress` describes it. `total: null` is
 * the "unknown total" case, which has its own rules everywhere in the app - it
 * is therefore written explicitly, never by omission.
 */
export function edition(options: {
  nom?: string
  possedes: number[]
  catalogues?: number[]
  total: number | null
}): EditionProgressDto {
  return {
    editionName: options.nom ?? '',
    sourceEditions: [options.nom ?? ''],
    ownedVolumeNumbers: options.possedes,
    cataloguedVolumeNumbers: options.catalogues ?? options.possedes,
    totalVolumes: options.total,
  }
}

/** The index that the screens consume: a work, its dominant edition. */
export function progressionDe(
  entity: EntityResponse,
  dominante: EditionProgressDto | null,
): Map<string, CollectionProgressDto> {
  return new Map([
    [
      entity.id,
      {
        entityId: entity.id,
        title: entity.title,
        editions: dominante ? [dominante] : [],
        dominantEdition: dominante,
        ownedVolumeCount: dominante ? dominante.ownedVolumeNumbers.length : 0,
      },
    ],
  ])
}

export function typeDeCollection(code: string, label = code): EntityTypeDto {
  return {
    id: `type-${code.toLowerCase()}`,
    code,
    label,
    allowedExperienceTypes: [],
    customFieldKeys: [],
    hasMetadataProvider: false,
    hasDiscoverySource: false,
    hasReleaseSource: false,
    colorKey: null,
    iconKey: null,
    aspectKey: null,
  }
}
