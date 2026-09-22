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
 * La progression calculée PAR LE SERVEUR, indexée par œuvre.
 *
 * <h2>Lire, plutôt que recalculer</h2>
 * Cet écran dérivait sa propre progression d'un référentiel d'éditions et d'un
 * `singleNamedEdition` maison. Le serveur expose exactement la même chose
 * (`GET /insights/progress`), avec une règle de plus : un tome catalogué SANS
 * édition précisée rejoint l'unique édition nommée de la série. Recalculer de
 * son côté a déjà produit deux divergences documentées - une série annoncée
 * 2/72 ici et 3/72 là (lot 31), puis une analyse d'achat conseillant de
 * racheter un tome déjà possédé (lot 49). La règle vit désormais à un seul
 * endroit, et cet écran la consomme.
 */
export function indexerProgression(progressions: CollectionProgressDto[]): Map<string, CollectionProgressDto> {
  return new Map(progressions.map((progression) => [progression.entityId, progression]))
}

/** L'édition qui représente une œuvre dans une liste - celle que le serveur a
 *  retenue. `null` pour une œuvre sans tome (jeu vidéo, jeu de société). */
function editionRepresentative(
  entity: EntityResponse,
  progression: Map<string, CollectionProgressDto>,
): EditionProgressDto | null {
  return progression.get(entity.id)?.dominantEdition ?? null
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
    // Un type sans tome : l'œuvre EST l'objet, elle est donc possédée ou
    // voulue - le décompte de tomes ne veut rien dire ici.
    return {
      key: entity.id,
      title: entity.title,
      subtitle: envie.possede ? 'Possédé' : envie.suivi ? 'Suivie' : 'Dans mes envies',
      imageUrl: coverImageUrlFrom(entity.attributes),
      entityId: entity.id,
    }
  }
  // Le décompte vient du serveur : il inclut les tomes sans édition précisée
  // rattachés à cette édition, que le calcul local d'ici oubliait.
  const editionAffichee = editionRepresentative(entity, progression)
  const ownedCount = editionAffichee ? editionAffichee.ownedVolumeNumbers.length : 0
  const total = editionAffichee?.totalVolumes ?? null
  const countPart =
    ownedCount === 0 ? 'aucun tome encore' : total !== null ? `${ownedCount}/${total} tomes` : formatTomeCount(ownedCount)
  const edition = editionAffichee && editionAffichee.editionName !== '' ? editionAffichee.editionName : null
  return {
    key: entity.id,
    title: entity.title,
    // Le décompte d'abord : sur un rayon à trois colonnes, le sous-titre est
    // coupé, et c'est « 4/43 tomes » qu'il faut lire, pas le nom de l'éditeur.
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

/** null = complétude inconnue (pas de tome, éditions mélangées, ou édition
 * sans fiche de référence renseignée) - jamais devinée, voir isSeriesOngoing
 * pour le même principe. Interne : seul `matchesCompletionFilter` ci-dessous
 * s'en sert. */
function isComplete(entity: EntityResponse, progression: Map<string, CollectionProgressDto>): boolean | null {
  const editionAffichee = editionRepresentative(entity, progression)
  if (!editionAffichee || editionAffichee.totalVolumes === null) return null
  return editionAffichee.ownedVolumeNumbers.length >= editionAffichee.totalVolumes
}

export type CompletionFilter = 'ALL' | 'INCOMPLETE' | 'COMPLETE'

/** Une entité sans complétude connue (isComplete === null) ne correspond à
 * AUCUN filtre d'état sauf "Toutes" - jamais classée par défaut d'un côté
 * ou de l'autre faute de donnée réelle. */
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

/** Combien de TITRES chaque type compte dans cette collection - ce qui décide de l'ordre des rails. */
export function compterLesTitresParType(entities: EntityResponse[]): Map<string, number> {
  const titres = new Map<string, number>()
  for (const entity of entities) {
    titres.set(entity.entityTypeId, (titres.get(entity.entityTypeId) ?? 0) + 1)
  }
  return titres
}

/**
 * L'ordre des rails : le type le plus fourni d'abord, puis par libellé.
 *
 * <h2>Pourquoi les données, et pas une liste de codes</h2>
 * L'ordre était écrit dans le code - manga, jeu vidéo, jeu de société, puis
 * le reste - c'est-à-dire l'univers de départ en premier, quoi qu'on
 * collectionne. Ma collection appartient au cœur (lot 136) : ce qu'on
 * collectionne le plus passe en premier, et une catégorie créée demain se
 * range comme les autres. À égalité, le libellé - un ordre qu'on peut
 * prévoir, jamais celui d'arrivée du serveur.
 *
 * <p>Compté en TITRES, et partagé par les DEUX vues : grouper puis dégrouper
 * ne doit pas changer l'ordre dans lequel les univers défilent, alors que
 * trois séries de vingt tomes pèsent plus lourd que dix jeux une fois
 * dégroupées.
 */
export function ordonnerLesTypes(entityTypes: EntityTypeDto[], titresParType: Map<string, number>): EntityTypeDto[] {
  return [...entityTypes].sort(
    (a, b) =>
      (titresParType.get(b.id) ?? 0) - (titresParType.get(a.id) ?? 0) || a.label.localeCompare(b.label, 'fr'),
  )
}

/** Regroupe les œuvres retenues par type, SANS les types à 0 titre (jamais un
 *  rail vide qui n'aurait rien à faire défiler), dans l'ordre de
 *  `ordonnerLesTypes` - compté sur `titresParType` quand l'appelant le donne
 *  (toute la collection, avant filtre), sur les œuvres reçues sinon. */
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
// Trois filtres, deux vues (étude produit du 2026-08-27, §5 et §6)
// ---------------------------------------------------------------------------

/**
 * L'état personnel d'une œuvre, résumé pour le filtrage.
 *
 * Une œuvre n'est ici qu'un GROUPE : ce sont les éléments qu'elle contient qui
 * portent l'état. « Possédée » veut dire « au moins un élément possédé », et
 * « voulue » « au moins un élément dans les envies » - jamais un état propre à
 * l'œuvre, qui n'en a pas.
 *
 * <p>Pour un type sans variante (jeu vidéo, jeu de société), l'œuvre EST
 * l'élément collectionnable : la possession est rattachée à l'Entity, et
 * l'envie aussi (voir lib/typeDeCollection).
 */
interface EtatOeuvre {
  possede: boolean
  voulu: boolean
  /** Suivie : le troisième état, celui qui met l'œuvre au calendrier des sorties. */
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
 * Un ÉLÉMENT, tel que la vue DÉGROUPÉE l'affiche : l'objet individuel, sorti
 * du groupe qui ne servait qu'à le ranger. Un tome pour un manga, l'œuvre
 * elle-même pour un type qui se possède d'une seule pièce.
 *
 * `etat` est ce qui distingue deux tuiles d'un même groupe sous le filtre
 * « Tout » - sans lui, un élément voulu et un élément possédé se
 * ressembleraient trait pour trait.
 */
export interface TuileElement extends ShelfTile {
  etat: 'possede' | 'voulu' | 'suivi'
  /** Le type porte le format de jaquette (2/3 pour un manga, carré pour un
   *  jeu de société) : sans lui, la grille plate mélangerait les cadres. */
  entityTypeId: string
  /** Date de l'acquisition ou de l'envie - ce sur quoi porte le tri « récent ». */
  depuis: string
}

function libelleDeLElement(variant: VariantDto): string {
  const numero = numeroDe(variant)
  const edition = editionDe(variant)
  const base = numero !== null ? `Tome ${numero}` : variant.label
  return edition ? `${base} · ${edition}` : base
}

/**
 * Aplatit les œuvres retenues en tuiles d'ÉLÉMENTS.
 *
 * Une œuvre sans variante (jeu vidéo, jeu de société) donne une seule tuile,
 * elle-même : c'est déjà l'objet individuel de son type, il n'y a rien à
 * aplatir. Une œuvre à variantes en donne une par variante retenue - des
 * tomes pour un manga, et le libellé de la variante pour tout autre type.
 *
 * <p>Les tuiles ne portent PAS leur type : c'est la section qui l'annonce
 * (voir GrilleElements), et le répéter sur chacune des soixante-douze tuiles
 * d'une même section n'apprendrait rien.
 */
export function aplatirEnElements(
  entities: EntityResponse[],
  filtre: FiltreCollection,
  contexte: {
    ownerships: OwnershipResponse[]
    owned: Set<string>
    tomesVoulus: Set<string>
    oeuvresVoulues: Set<string>
    /** Les œuvres suivies : une œuvre d'une pièce suivie sans être possédée est une tuile « Suivie ». */
    oeuvresSuivies?: Set<string>
    /** Depuis quand cet élément est possédé, ou voulu - selon ce qu'il est. */
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

function retenu(etat: 'possede' | 'voulu' | 'suivi', filtre: FiltreCollection): boolean {
  if (filtre === 'possedes') return etat === 'possede'
  if (filtre === 'envies') return etat === 'voulu'
  if (filtre === 'suivies') return etat === 'suivi'
  return true
}

/** Les possessions de CETTE œuvre - `isOwned` sans tome parcourt la liste
 *  entière, autant ne lui donner que ce qui la concerne. */
function ownershipsDe(entity: EntityResponse, ownerships: OwnershipResponse[]): OwnershipResponse[] {
  return ownerships.filter((o) => o.entityId === entity.id)
}
