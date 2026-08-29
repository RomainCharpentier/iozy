/**
 * Les objets que le serveur renvoie, construits en une ligne.
 *
 * <h2>Pourquoi des constructeurs plutôt que des littéraux</h2>
 * `EntityResponse` porte six champs dont un seul intéresse un test donné. Écrit
 * à la main, chaque cas noierait sa règle sous cinq champs de remplissage - et
 * le jour où le DTO en gagne un, ce sont tous les tests qu'il faut rouvrir.
 * Ici, un test ne nomme QUE ce qui le concerne : `oeuvre({ titre: 'Berserk',
 * tomes: [tome(1)] })` se lit comme la phrase qu'il vérifie.
 *
 * <p>Les identifiants sont dérivés de ce qu'on donne (`tome-1`, `berserk`)
 * plutôt que tirés au hasard : un test qui échoue nomme alors l'objet fautif au
 * lieu d'un UUID que personne ne peut relier à quoi que ce soit.
 */
import type {
  CollectionProgressDto,
  EditionProgressDto,
  EntityResponse,
  EntityTypeDto,
  OwnershipResponse,
  VariantDto,
} from '../types/api'

/** Un identifiant lisible : le titre réduit à ce qui peut servir de clé. */
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
}): EntityResponse {
  return {
    id: idDe(options.titre),
    entityTypeId: options.typeId ?? 'type-manga',
    title: options.titre,
    attributes: options.jaquette !== undefined ? { coverImageUrl: options.jaquette } : {},
    tagIds: [],
    variants: options.tomes ?? [],
  }
}

/** Une possession, active sauf mention contraire - c'est le cas courant. */
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
 * Une édition telle que `GET /insights/progress` la décrit. `total: null` est
 * le cas « total inconnu », qui a ses propres règles partout dans l'app - il
 * s'écrit donc explicitement, jamais par omission.
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

/** L'index que les écrans consomment : une œuvre, son édition dominante. */
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
    colorKey: null,
    iconKey: null,
    aspectKey: null,
  }
}
