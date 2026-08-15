import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2 } from 'lucide-react'
import { mergeVariantAttributes, searchEntities } from '../../api/entities'
import { searchVolumes } from '../../api/metadata'
import { listAllOwnerships } from '../../api/ownerships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { CoverTile } from '../../components/CoverTile'
import { Chip } from '../../components/Chip'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { totalVolumesFrom } from '../../lib/seriesInfo'
import { StatCard } from '../../components/StatCard'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TypeFilterChips } from './TypeFilterChips'
import { findBestCoverMatch, variantsMissingCover } from './backfillCovers'
import { useNavigate } from 'react-router-dom'
import type { EntityResponse, EntityTypeDto, OwnershipResponse, VariantDto } from '../../types/api'

// Référence stable pour le fallback "pas encore chargé" - un `[]` inline
// serait recréé à chaque render et invaliderait la mémoïsation de `counts`.
const EMPTY_ENTITIES: EntityResponse[] = []
const EMPTY_ENTITY_TYPES: EntityTypeDto[] = []
const EMPTY_OWNERSHIPS: OwnershipResponse[] = []

interface Tile {
  key: string
  title: string
  subtitle?: string
  // Badge de type ("Manga", "Jeu vidéo"...) - toujours renseigné quand le
  // type est connu, distinct du sous-titre (voir CoverTile.typeLabel et la
  // refonte layout demandée : objet/type/état sont 3 informations séparées).
  typeLabel?: string
  imageUrl: string | null
  gradientKey?: string
  entityId: string
  // Absent pour une Entity sans Variant (jeu vidéo/société, ou manga ajouté
  // sans préciser de tome) - sert à amener la fiche directement sur CE tome
  // (voir onClick ci-dessous et EntityDetailPage) plutôt que sur la série
  // entière sans indication de laquelle des possessions on vient de cliquer.
  variantId?: string
}

/** Modèle Tome != Ownership (voir backend, étapes 4-8) : un Variant catalogué
 * n'est pas forcément possédé (ex: exemplaire revendu dont l'Ownership a été
 * supprimée, mais dont le Tome reste connu). "Ma collection" montre ce que
 * l'utilisateur possède RÉELLEMENT, jamais tout ce qui est catalogué -
 * l'inverse ("ce qui manque") est le rôle de la fiche Série, pas de cet écran. */
function ownedVariantIds(ownerships: OwnershipResponse[]): Set<string> {
  const ids = new Set<string>()
  for (const o of ownerships) {
    if (o.status === 'OWNED' && o.variantId) ids.add(o.variantId)
  }
  return ids
}

/** true si l'Entity a au moins une possession active - pour une Entity sans
 * notion de tome (jeu vidéo/société), l'Ownership est directement rattachée
 * à l'Entity (variantId absent), voir QuickAddService côté backend. */
function isOwned(entity: EntityResponse, ownerships: OwnershipResponse[], owned: Set<string>): boolean {
  if (entity.variants.length > 0) {
    return entity.variants.some((v) => owned.has(v.id))
  }
  return ownerships.some((o) => o.entityId === entity.id && o.status === 'OWNED')
}

/** "Tome 12" si un numéro de tome est exploitable (voir QuickAddService côté
 * backend, attribut "volumeNumber" du Variant), sinon le label brut du
 * Variant (ex: un ajout plus ancien, sans ce numéro structuré). */
function variantSubtitle(variant: VariantDto): string {
  const volumeNumber = variant.attributes.volumeNumber
  return typeof volumeNumber === 'number' ? `Tome ${volumeNumber}` : variant.label
}

/** Une tuile par tome RÉELLEMENT POSSÉDÉ, avec la jaquette PROPRE À CE TOME
 * uniquement - jamais un repli sur la jaquette de la série (afficherait la
 * même image sur tous les tomes d'une série). Sans jaquette propre au tome,
 * CoverTile retombe sur un dégradé - gradientKey inclut le sous-titre pour
 * que chaque tome garde une couleur distincte plutôt que le même dégradé
 * répété. Une Entity sans Variant possédée (jeu vidéo, jeu de société, ou
 * manga ajouté sans préciser de tome) garde une tuile unique avec la
 * jaquette de l'Entity - son sous-titre retombe sur le type (voir
 * entityTypeLabel) pour rester reconnaissable dans une grille qui mélange
 * plusieurs types (voir "vision UX" : une tuile doit permettre de reconnaître
 * l'objet, SON TYPE, et son état). */
function flattenToTomes(entities: EntityResponse[], owned: Set<string>, entityTypeLabel: (entity: EntityResponse) => string | undefined): Tile[] {
  const tiles: Tile[] = []
  for (const entity of entities) {
    const typeLabel = entityTypeLabel(entity)
    if (entity.variants.length === 0) {
      // "Possédé" (statut) plutôt que le type en sous-titre : le type a
      // maintenant son propre badge dédié (voir typeLabel ci-dessous), le
      // sous-titre ne doit plus faire les deux à la fois.
      tiles.push({
        key: entity.id,
        title: entity.title,
        subtitle: 'Possédé',
        typeLabel,
        imageUrl: coverImageUrlFrom(entity.attributes),
        entityId: entity.id,
      })
      continue
    }
    for (const variant of entity.variants) {
      if (!owned.has(variant.id)) continue
      const subtitle = variantSubtitle(variant)
      tiles.push({
        key: variant.id,
        title: entity.title,
        subtitle,
        typeLabel,
        imageUrl: coverImageUrlFrom(variant.attributes),
        gradientKey: `${entity.title} ${subtitle}`,
        entityId: entity.id,
        variantId: variant.id,
      })
    }
  }
  return tiles
}

function formatTomeCount(count: number): string {
  return `${count} tome${count > 1 ? 's' : ''}`
}

/** Nom d'édition à afficher en sous-titre, seulement quand il apporte une
 * vraie information : une série sans édition nommée (aucune, ou plusieurs
 * différentes - ambigu à résumer en une tuile) ne montre que la progression. */
function singleNamedEdition(entity: EntityResponse): string | null {
  const names = new Set(
    entity.variants
      .map((v) => (typeof v.attributes.edition === 'string' ? v.attributes.edition.trim() : ''))
      .filter((name) => name !== ''),
  )
  return names.size === 1 ? [...names][0] : null
}

/** "Perfect Edition · 8/18 tomes" - possédé réellement (voir ownedVariantIds),
 * jamais le simple compte catalogué. Le total n'est connu que pour une série
 * dont Jikan/MyAnimeList l'a fourni : jamais deviné en son absence, le compte
 * affiché se limite alors à ce qui est possédé. */
function seriesSubtitle(entity: EntityResponse, owned: Set<string>): string {
  const ownedCount = entity.variants.filter((v) => owned.has(v.id)).length
  const total = totalVolumesFrom(entity.attributes)
  const countPart = total !== null ? `${ownedCount}/${total} tomes` : formatTomeCount(ownedCount)
  const edition = singleNamedEdition(entity)
  return edition ? `${edition} · ${countPart}` : countPart
}

/** Une tuile par série possédée (jaquette de la série), avec la progression
 * réellement possédée en sous-titre - voir seriesSubtitle. Sans notion de
 * tome (jeu vidéo, jeu de société), rien à faire progresser : le sous-titre
 * retombe sur le type plutôt que de rester vide, même raison que
 * flattenToTomes ci-dessus. */
function groupBySeries(entities: EntityResponse[], owned: Set<string>, entityTypeLabel: (entity: EntityResponse) => string | undefined): Tile[] {
  return entities.map((entity) => ({
    key: entity.id,
    title: entity.title,
    // "Possédé" (statut) plutôt que le type en repli : voir flattenToTomes,
    // même raison - le type vit désormais dans typeLabel, pas ici.
    subtitle: entity.variants.length > 0 ? seriesSubtitle(entity, owned) : 'Possédé',
    typeLabel: entityTypeLabel(entity),
    imageUrl: coverImageUrlFrom(entity.attributes),
    entityId: entity.id,
  }))
}

export function ShelfPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  // Groupée par série par défaut : "Ma collection" se parcourt d'abord série
  // par série (couverture, titre, progression), pas tome par tome - voir
  // l'audit UX "ressemble à un écran d'administration". Le détail par tome
  // reste disponible via le bouton juste en dessous, pour qui préfère.
  const [grouped, setGrouped] = useState(true)

  // Sans paramètre, /entities/search renvoie toute la collection - c'est
  // notre "liste complète" pour l'étagère (pas de cache offline séparé,
  // contrairement à l'iOS : TanStack Query fait office de cache mémoire).
  const entitiesQuery = useQuery({
    queryKey: queryKeys.entities.search({}),
    queryFn: () => searchEntities({}),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const ownershipsQuery = useQuery({
    queryKey: queryKeys.allOwnerships,
    queryFn: listAllOwnerships,
  })

  const allEntities = entitiesQuery.data ?? EMPTY_ENTITIES
  const entityTypes = entityTypesQuery.data ?? EMPTY_ENTITY_TYPES
  const ownerships = ownershipsQuery.data ?? EMPTY_OWNERSHIPS
  const owned = useMemo(() => ownedVariantIds(ownerships), [ownerships])

  // Sous-titre de repli quand rien de plus spécifique ne s'applique (jeu
  // vidéo, jeu de société - voir groupBySeries/flattenToTomes) : le type
  // reste la seule info qui distingue vraiment ces tuiles entre elles dans
  // la vue "Tout" qui mélange les types (voir "vision UX" fournie par
  // l'utilisateur - une tuile doit rester reconnaissable par objet/type/état).
  const entityTypesById = useMemo(() => new Map(entityTypes.map((t) => [t.id, t])), [entityTypes])
  const entityTypeLabel = (entity: EntityResponse) => entityTypesById.get(entity.entityTypeId)?.label

  // "Ma collection" montre ce qui est réellement possédé - une série
  // entièrement cataloguée mais dont plus aucun exemplaire n'est possédé
  // (tout revendu) n'y a pas sa place, voir isOwned ci-dessus.
  const entities = useMemo(
    () => allEntities.filter((e) => isOwned(e, ownerships, owned)),
    [allEntities, ownerships, owned],
  )

  // "Retrouver les jaquettes manquantes" - voir backfillCovers.ts. Réutilise
  // GET /metadata/volumes (VolumeSelectionGrid côté Ajout rapide) qui met en
  // cache son résultat côté backend : pour une série déjà recherchée à
  // l'ajout (le cas le plus courant), un premier essai SANS forceRefresh ne
  // consomme aucun quota Google Books supplémentaire. Mais ce cache peut
  // avoir été rempli SANS jaquette pour tel tome précis (Google Books
  // n'indexe pas toujours de miniature) - sans un vrai nouvel essai, le
  // bouton rejouait indéfiniment ce même échec. Un forceRefresh n'est
  // déclenché qu'en second recours, uniquement pour les tomes encore sans
  // jaquette après le premier essai gratuit - jamais pour une série déjà complète.
  const mangaType = entityTypes.find((t) => t.code === 'MANGA')
  const entitiesMissingCovers = useMemo(
    () => (mangaType ? entities.filter((e) => e.entityTypeId === mangaType.id && variantsMissingCover(e).length > 0) : []),
    [entities, mangaType],
  )
  const [backfill, setBackfill] = useState<
    { running: boolean; processed: number; total: number; found: number; quotaExceeded: boolean } | null
  >(null)

  async function backfillMissingCovers() {
    if (!mangaType || entitiesMissingCovers.length === 0) return
    setBackfill({ running: true, processed: 0, total: entitiesMissingCovers.length, found: 0, quotaExceeded: false })
    let found = 0
    let quotaExceeded = false

    // Séquentiel, jamais Promise.all : chaque série coûte potentiellement un
    // vrai appel Google Books (cache manquant), un lot en parallèle risquerait
    // de vider le quota d'un coup plutôt que de s'arrêter proprement dessus.
    for (let i = 0; i < entitiesMissingCovers.length; i++) {
      const entity = entitiesMissingCovers[i]
      const author = typeof entity.attributes.mangaka === 'string' ? entity.attributes.mangaka : undefined
      try {
        let response = await searchVolumes(mangaType.id, entity.title, { author })
        if (response.quotaExceeded) {
          quotaExceeded = true
          break
        }
        const missingVariants = variantsMissingCover(entity)
        const stillUnmatched = missingVariants.some((v) => !findBestCoverMatch(response.volumes, v)?.imageUrl)
        if (stillUnmatched) {
          response = await searchVolumes(mangaType.id, entity.title, { author, forceRefresh: true })
          if (response.quotaExceeded) {
            quotaExceeded = true
            break
          }
        }
        for (const variant of missingVariants) {
          const match = findBestCoverMatch(response.volumes, variant)
          if (match?.imageUrl) {
            await mergeVariantAttributes(entity.id, variant.id, { coverImageUrl: match.imageUrl })
            found++
          }
        }
      } catch {
        // Best-effort par nature (voir VolumeSelectionGrid) - une série en échec
        // ne doit jamais bloquer les suivantes, elle reste juste sans jaquette.
      }
      setBackfill({ running: true, processed: i + 1, total: entitiesMissingCovers.length, found, quotaExceeded })
    }

    setBackfill({ running: false, processed: entitiesMissingCovers.length, total: entitiesMissingCovers.length, found, quotaExceeded })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  // Compte par type pour les chips de filtre ("Manga 4", voir la maquette) -
  // délibérément stable face au bascule Par série/Par tome (grouped) : le
  // nombre de séries possédées ne doit pas changer visuellement selon le
  // mode d'affichage de la grille, ce serait déroutant sur un simple
  // compteur. Contrairement à l'ancien countsByType, jamais filtré à
  // count > 0 - un type sans rien possédé reste visible avec "0" (voir la
  // maquette "[Jeu vidéo 0] [Jeu de société 0]").
  const countsByTypeId = useMemo(() => {
    const map = new Map<string, number>()
    for (const type of entityTypes) {
      map.set(type.id, entities.filter((e) => e.entityTypeId === type.id).length)
    }
    return map
  }, [entities, entityTypes])

  // Les deux seules statistiques "réellement intéressantes" au sens de la
  // maquette qui ne dupliquent pas une info déjà portée par les chips de
  // filtre ci-dessus (voir "ajoute une carte Total" jugé redondant) - toutes
  // deux dérivées de données déjà chargées ici, aucun nouveau calcul côté
  // backend (voir "ne crée pas de nouvelles fonctionnalités statistiques").
  const completeSeriesCount = useMemo(
    () =>
      entities.filter((e) => {
        if (e.variants.length === 0) return false
        const total = totalVolumesFrom(e.attributes)
        if (total === null) return false
        return e.variants.filter((v) => owned.has(v.id)).length >= total
      }).length,
    [entities, owned],
  )
  const addedThisMonthCount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    return ownerships.filter((o) => o.status === 'OWNED' && o.acquiredAt.startsWith(currentMonth)).length
  }, [ownerships])

  // >= 2 stats utiles : petit groupe de cartes. Exactement 1 : forme
  // compacte inline plutôt qu'une carte isolée à droite sans les autres pour
  // lui tenir compagnie (voir la refonte layout demandée - c'était
  // précisément le rendu "8 / Ajouts ce mois" isolé signalé comme problème).
  // 0 : rien, jamais de carte vide pour remplir l'espace.
  const usefulStats = [
    completeSeriesCount > 0 ? { label: 'Séries complètes', value: completeSeriesCount } : null,
    addedThisMonthCount > 0 ? { label: 'Ajouts ce mois', value: addedThisMonthCount } : null,
  ].filter((s): s is { label: string; value: number } => s !== null)

  const visibleEntities = selectedTypeId
    ? entities.filter((e) => e.entityTypeId === selectedTypeId)
    : entities

  const tiles = useMemo(
    () =>
      grouped
        ? groupBySeries(visibleEntities, owned, entityTypeLabel)
        : flattenToTomes(visibleEntities, owned, entityTypeLabel),
    [grouped, visibleEntities, owned, entityTypesById],
  )

  const isLoading = entitiesQuery.isLoading || ownershipsQuery.isLoading

  return (
    <div>
      {/* ShelfHeader : titre+filtres à gauche, stats à droite - flex row
          desktop, empilé mobile (voir la refonte layout demandée). Pas de
          carte "Total"/par-type séparée : strictement redondante avec le
          compte déjà porté par les chips (ex. "Manga 4"). */}
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row">
        <div>
          <h1 className="font-display text-2xl font-bold text-textPrimary">Ma collection</h1>
          <div className="mt-3">
            <TypeFilterChips
              entityTypes={entityTypes}
              selectedTypeId={selectedTypeId}
              onChange={setSelectedTypeId}
              totalCount={entities.length}
              countsByTypeId={countsByTypeId}
            />
          </div>
        </div>
        {usefulStats.length >= 2 && (
          <div className="flex gap-3">
            {usefulStats.map((s) => (
              <StatCard key={s.label} value={String(s.value)} label={s.label} />
            ))}
          </div>
        )}
        {usefulStats.length === 1 && (
          <p className="text-sm text-textDim">
            {usefulStats[0].label} : <span className="font-medium text-textPrimary">{usefulStats[0].value}</span>
          </p>
        )}
      </div>

      {/* ShelfToolbar : une seule ligne logique - uniquement les modes
          réellement disponibles (voir "seulement pour les fonctionnalités
          réellement disponibles"). Par série/Par tome est un vrai mode de
          visualisation de la même grille (voir grouped) : deux chips groupées
          plutôt qu'un bouton "Détail par tome" isolé sans contexte. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Chip label="Par série" isActive={grouped} onClick={() => setGrouped(true)} />
          <Chip label="Par tome" isActive={!grouped} onClick={() => setGrouped(false)} />
        </div>
        {!grouped && entitiesMissingCovers.length > 0 && (
          <button
            type="button"
            onClick={backfillMissingCovers}
            disabled={backfill?.running}
            title="Retrouver les jaquettes manquantes"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-textDim hover:text-textPrimary disabled:opacity-50"
          >
            {backfill?.running ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
          </button>
        )}
      </div>

      {backfill && !backfill.running && (
        <p className="mt-3 text-xs text-textDim">
          {backfill.found > 0
            ? `${backfill.found} jaquette${backfill.found > 1 ? 's' : ''} retrouvée${backfill.found > 1 ? 's' : ''}.`
            : 'Aucune jaquette retrouvée cette fois.'}
          {backfill.quotaExceeded &&
            ` Quota Google Books dépassé - ${backfill.processed}/${backfill.total} séries traitées, réessaie plus tard pour les autres.`}
        </p>
      )}

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}
      {ownershipsQuery.isError && <ErrorBanner message={ownershipsQuery.error.message} />}

      {isLoading && <p className="mt-4 text-textDim">Chargement...</p>}

      {!isLoading && entitiesQuery.isSuccess && visibleEntities.length === 0 && (
        <p className="mt-4 text-textDim">
          Rien ici pour l'instant - utilise l'onglet "Rechercher" pour commencer ta collection.
        </p>
      )}

      {/* CollectionGrid : le nombre de colonnes s'adapte à la largeur
          disponible plutôt qu'un nombre fixe qui resterait figé pendant que
          le container s'élargit (voir AppShell) - cible 3/4/5/6 colonnes à
          375/768/1280/1920px (voir la maquette validée), jamais un nombre
          qui maximiserait le compte au détriment de la taille réelle des
          jaquettes. */}
      <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5 2xl:grid-cols-6">
        {tiles.map((tile) => (
          <CoverTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            typeLabel={tile.typeLabel}
            imageUrl={tile.imageUrl}
            gradientKey={tile.gradientKey}
            onClick={() =>
              navigate(tile.variantId ? `/entity/${tile.entityId}?variant=${tile.variantId}` : `/entity/${tile.entityId}`)
            }
          />
        ))}
      </div>
    </div>
  )
}
