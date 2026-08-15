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
 * jaquette de l'Entity. */
function flattenToTomes(entities: EntityResponse[], owned: Set<string>): Tile[] {
  const tiles: Tile[] = []
  for (const entity of entities) {
    if (entity.variants.length === 0) {
      tiles.push({ key: entity.id, title: entity.title, imageUrl: coverImageUrlFrom(entity.attributes), entityId: entity.id })
      continue
    }
    for (const variant of entity.variants) {
      if (!owned.has(variant.id)) continue
      const subtitle = variantSubtitle(variant)
      tiles.push({
        key: variant.id,
        title: entity.title,
        subtitle,
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
 * réellement possédée en sous-titre - voir seriesSubtitle. */
function groupBySeries(entities: EntityResponse[], owned: Set<string>): Tile[] {
  return entities.map((entity) => ({
    key: entity.id,
    title: entity.title,
    subtitle: entity.variants.length > 0 ? seriesSubtitle(entity, owned) : undefined,
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

  // Généralisé en un compte par type plutôt que le bucket fixe "Mangas/Jeux"
  // d'origine - un type sans aucune Entity possédée n'apparaît pas.
  //
  // Compte le nombre de TUILES (flattenToTomes/groupBySeries, jamais
  // entities.length brut) pour rester exactement cohérent avec ce que la
  // grille affiche selon le mode courant.
  const countsByType = useMemo(
    () =>
      entityTypes
        .map((type) => {
          const entitiesOfType = entities.filter((e) => e.entityTypeId === type.id)
          const count = grouped ? entitiesOfType.length : flattenToTomes(entitiesOfType, owned).length
          return { type, count }
        })
        .filter((entry) => entry.count > 0),
    [entities, entityTypes, grouped, owned],
  )

  const visibleEntities = selectedTypeId
    ? entities.filter((e) => e.entityTypeId === selectedTypeId)
    : entities

  const tiles = useMemo(
    () => (grouped ? groupBySeries(visibleEntities, owned) : flattenToTomes(visibleEntities, owned)),
    [grouped, visibleEntities, owned],
  )
  const totalCount = grouped ? entities.length : flattenToTomes(entities, owned).length

  const isLoading = entitiesQuery.isLoading || ownershipsQuery.isLoading

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Ma collection</h1>

      <div className="flex gap-3 overflow-x-auto">
        <StatCard value={String(totalCount)} label="Total" />
        {countsByType.map((entry) => (
          <StatCard key={entry.type.id} value={String(entry.count)} label={entry.type.label} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypeFilterChips entityTypes={entityTypes} selectedTypeId={selectedTypeId} onChange={setSelectedTypeId} />
        <div className="flex items-center gap-1.5">
          <Chip label="Détail par tome" isActive={!grouped} onClick={() => setGrouped((v) => !v)} />
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
      </div>

      {backfill && !backfill.running && (
        <p className="text-xs text-textDim">
          {backfill.found > 0
            ? `${backfill.found} jaquette${backfill.found > 1 ? 's' : ''} retrouvée${backfill.found > 1 ? 's' : ''}.`
            : 'Aucune jaquette retrouvée cette fois.'}
          {backfill.quotaExceeded &&
            ` Quota Google Books dépassé - ${backfill.processed}/${backfill.total} séries traitées, réessaie plus tard pour les autres.`}
        </p>
      )}

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}
      {ownershipsQuery.isError && <ErrorBanner message={ownershipsQuery.error.message} />}

      {isLoading && <p className="text-textDim">Chargement...</p>}

      {!isLoading && entitiesQuery.isSuccess && visibleEntities.length === 0 && (
        <p className="text-textDim">
          Rien ici pour l'instant - utilise l'onglet "Rechercher" pour commencer ta collection.
        </p>
      )}

      {/* Même logique que la grille de tomes de la fiche Série : le nombre de
          colonnes s'adapte à la largeur disponible plutôt qu'un nombre fixe,
          qui aurait étiré chaque jaquette en grand sur desktop. */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {tiles.map((tile) => (
          <CoverTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
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
