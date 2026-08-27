import { coverImageUrlFrom } from '../../lib/coverImage'
import { isOwned } from './ownership'
import type { FiltreCollection } from '../../lib/preferencesCollection'
import type { EntityResponse, EntityTypeDto, OwnershipResponse, VariantDto } from '../../types/api'
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

/**
 * La carte d'une SÉRIE en vue groupée.
 *
 * `envie` décrit ce que le groupe contient de voulu. Sans elle, une série
 * qu'on veut sans en posséder un seul tome s'annonçait « 0 tome » : un
 * décompte de possession posé sur une carte qui n'est là que parce qu'on la
 * veut. Et sous le filtre « Envies », c'est le nombre de tomes voulus qui est
 * LE signal pertinent - il prend alors le pas sur « Plus que 2 tomes », pour
 * respecter la règle d'un seul signal par carte, jamais empilé.
 */
export function buildShelfTile(
  entity: EntityResponse,
  owned: Set<string>,
  editionTotals: Map<string, number>,
  envie: { possede: boolean; tomesVoulus: number; prioritaire: boolean } = {
    possede: true,
    tomesVoulus: 0,
    prioritaire: false,
  },
): ShelfTile {
  const signalEnvie =
    envie.tomesVoulus > 0 ? `${envie.tomesVoulus} tome${envie.tomesVoulus > 1 ? 's' : ''} voulu${envie.tomesVoulus > 1 ? 's' : ''}` : undefined

  if (entity.variants.length === 0) {
    // Un type sans tome : l'œuvre EST l'objet, elle est donc possédée ou
    // voulue - le décompte de tomes ne veut rien dire ici.
    return {
      key: entity.id,
      title: entity.title,
      subtitle: envie.possede ? 'Possédé' : 'Dans mes envies',
      imageUrl: coverImageUrlFrom(entity.attributes),
      entityId: entity.id,
    }
  }
  const ownedCount = entity.variants.filter((v) => owned.has(v.id)).length
  const total = editionTotalFor(entity, editionTotals)
  const countPart =
    ownedCount === 0 ? 'aucun tome encore' : total !== null ? `${ownedCount}/${total} tomes` : formatTomeCount(ownedCount)
  const edition = singleNamedEdition(entity)
  return {
    key: entity.id,
    title: entity.title,
    subtitle: edition ? `${edition} · ${countPart}` : countPart,
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
  envieDe: (entity: EntityResponse) => { possede: boolean; tomesVoulus: number; prioritaire: boolean } = () => ({
    possede: true,
    tomesVoulus: 0,
    prioritaire: false,
  }),
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
        .map((e) => buildShelfTile(e, owned, editionTotals, envieDe(e))),
    }))
    .filter((section) => section.tiles.length > 0)
}

// ---------------------------------------------------------------------------
// Trois filtres, deux vues (étude produit du 2026-08-27, §5 et §6)
// ---------------------------------------------------------------------------

/**
 * L'état personnel d'une œuvre, résumé pour le filtrage.
 *
 * Une œuvre n'est ici qu'un GROUPE : ce sont les tomes qu'elle contient qui
 * portent l'état. « Possédée » veut dire « au moins un tome possédé », et
 * « voulue » « au moins un tome dans les envies » - jamais un état propre à
 * la série, qui n'existe pas.
 *
 * <p>Pour un type sans notion de tome (jeu vidéo, jeu de société), l'œuvre
 * EST l'objet collectionnable : la possession est rattachée à l'Entity, et
 * l'envie aussi (voir lib/typeDeCollection).
 */
export interface EtatOeuvre {
  possede: boolean
  voulu: boolean
}

export function etatDeLOeuvre(
  entity: EntityResponse,
  ownerships: OwnershipResponse[],
  owned: Set<string>,
  tomesVoulus: Set<string>,
  oeuvresVoulues: Set<string>,
): EtatOeuvre {
  return {
    possede: isOwned(entity, ownerships, owned),
    voulu:
      oeuvresVoulues.has(entity.id) || entity.variants.some((variant) => tomesVoulus.has(variant.id)),
  }
}

export function correspondAuFiltre(etat: EtatOeuvre, filtre: FiltreCollection): boolean {
  if (filtre === 'possedes') return etat.possede
  if (filtre === 'envies') return etat.voulu
  return etat.possede || etat.voulu
}

/**
 * Un tome, tel que la vue NON GROUPÉE l'affiche : l'objet individuel, sorti
 * du groupe qui ne servait qu'à le ranger.
 *
 * `etat` est ce qui distingue deux tuiles de même série sous le filtre
 * « Tout » - sans lui, un tome voulu et un tome possédé se ressembleraient
 * trait pour trait.
 */
export interface TuileTome extends ShelfTile {
  etat: 'possede' | 'voulu'
  typeLabel?: string
  /** Le type porte le format de jaquette (2/3 pour un manga, carré pour un
   *  jeu de société) : sans lui, la grille plate mélangerait les cadres. */
  entityTypeId: string
  /** Date de l'acquisition ou de l'envie - ce sur quoi porte le tri « récent ». */
  depuis: string
}

function libelleDuTome(variant: VariantDto): string {
  const numero = variant.attributes.volumeNumber
  const edition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
  const base = typeof numero === 'number' ? `Tome ${numero}` : variant.label
  return edition ? `${base} · ${edition}` : base
}

/**
 * Aplatit les œuvres retenues en tuiles de TOMES.
 *
 * Une œuvre sans tome (jeu vidéo, jeu de société) donne une seule tuile,
 * elle-même : c'est déjà l'objet individuel de son type, il n'y a rien à
 * aplatir.
 */
export function aplatirEnTomes(
  entities: EntityResponse[],
  filtre: FiltreCollection,
  contexte: {
    ownerships: OwnershipResponse[]
    owned: Set<string>
    tomesVoulus: Set<string>
    oeuvresVoulues: Set<string>
    /** Depuis quand ce tome est possédé, ou voulu - selon ce qu'il est. */
    depuisTome: (variantId: string) => string
    depuisOeuvre: (entityId: string) => string
    libelleDuType: (entity: EntityResponse) => string | undefined
  },
): TuileTome[] {
  const tuiles: TuileTome[] = []
  for (const entity of entities) {
    const typeLabel = contexte.libelleDuType(entity)
    if (entity.variants.length === 0) {
      const etat = isOwned(entity, ownershipsDe(entity, contexte.ownerships), contexte.owned) ? 'possede' : 'voulu'
      if (retenu(etat, filtre)) {
        tuiles.push({
          key: entity.id,
          title: entity.title,
          subtitle: etat === 'possede' ? 'Possédé' : 'Dans mes envies',
          typeLabel,
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
      const sousTitre = libelleDuTome(variant)
      tuiles.push({
        key: variant.id,
        title: entity.title,
        subtitle: sousTitre,
        typeLabel,
        imageUrl: coverImageUrlFrom(variant.attributes) ?? coverImageUrlFrom(entity.attributes),
        // Sans jaquette propre au tome, le dégradé de repli serait le même
        // pour toute la série : le sous-titre le fait varier tome par tome.
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

function retenu(etat: 'possede' | 'voulu', filtre: FiltreCollection): boolean {
  if (filtre === 'possedes') return etat === 'possede'
  if (filtre === 'envies') return etat === 'voulu'
  return true
}

/** Les possessions de CETTE œuvre - `isOwned` sans tome parcourt la liste
 *  entière, autant ne lui donner que ce qui la concerne. */
function ownershipsDe(entity: EntityResponse, ownerships: OwnershipResponse[]): OwnershipResponse[] {
  return ownerships.filter((o) => o.entityId === entity.id)
}
