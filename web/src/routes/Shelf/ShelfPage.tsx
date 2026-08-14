import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Loader2, Settings, Upload } from 'lucide-react'
import { mergeVariantAttributes, searchEntities } from '../../api/entities'
import { importBggCollection, searchVolumes } from '../../api/metadata'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { CoverTile } from '../../components/CoverTile'
import { Chip } from '../../components/Chip'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { totalVolumesFrom, isSeriesOngoing } from '../../lib/seriesInfo'
import { StatCard } from '../../components/StatCard'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TypeFilterChips } from './TypeFilterChips'
import { findBestCoverMatch, variantsMissingCover } from './backfillCovers'
import { useNavigate } from 'react-router-dom'
import type { EntityResponse, EntityTypeDto, VariantDto } from '../../types/api'

// Référence stable pour le fallback "pas encore chargé" - un `[]` inline
// serait recréé à chaque render et invaliderait la mémoïsation de `counts`.
const EMPTY_ENTITIES: EntityResponse[] = []
const EMPTY_ENTITY_TYPES: EntityTypeDto[] = []

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

/** "Tome 12" si un numéro de tome est exploitable (voir QuickAddService côté
 * backend, attribut "volumeNumber" du Variant), sinon le label brut du
 * Variant (ex: un ajout plus ancien, sans ce numéro structuré). */
function variantSubtitle(variant: VariantDto): string {
  const volumeNumber = variant.attributes.volumeNumber
  return typeof volumeNumber === 'number' ? `Tome ${volumeNumber}` : variant.label
}

/** Une tuile par tome, avec la jaquette PROPRE À CE TOME uniquement - jamais
 * un repli sur la jaquette de la série (voir la demande "afficher chacun
 * des tomes avec les bonnes illustrations" : un repli sur la jaquette de
 * série ferait apparaître la même image sur tous les tomes d'une série,
 * ce qui va exactement à l'encontre de cette vue). Sans jaquette propre au
 * tome (ajout en saisie libre, ou tome sélectionné hors grille visuelle),
 * CoverTile retombe sur un dégradé - gradientKey inclut le sous-titre pour
 * que chaque tome garde une couleur distincte plutôt que le même dégradé
 * répété (calculé depuis le seul titre de la série sinon). Une Entity sans
 * Variant (jeu vidéo, jeu de société, ou manga ajouté sans préciser de
 * tome) garde une tuile unique avec la jaquette de l'Entity - elle n'a pas
 * de tome dont la jaquette serait différente. */
function flattenToTomes(entities: EntityResponse[]): Tile[] {
  const tiles: Tile[] = []
  for (const entity of entities) {
    if (entity.variants.length === 0) {
      tiles.push({ key: entity.id, title: entity.title, imageUrl: coverImageUrlFrom(entity.attributes), entityId: entity.id })
      continue
    }
    for (const variant of entity.variants) {
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

/** "17/26 tomes · En cours" - le total et le statut ne sont connus que pour
 * une série ajoutée depuis que Jikan/MyAnimeList les fournissent (voir
 * lib/seriesInfo.ts) : jamais inventés en leur absence, le compte affiché
 * se limite alors à ce qu'on possède réellement. */
function seriesSubtitle(entity: EntityResponse): string {
  const owned = entity.variants.length
  const total = totalVolumesFrom(entity.attributes)
  const ongoing = isSeriesOngoing(entity.attributes)
  const countPart = total !== null ? `${owned}/${total} tomes` : formatTomeCount(owned)
  const statusPart = ongoing === null ? null : ongoing ? 'En cours' : 'Terminée'
  return statusPart ? `${countPart} · ${statusPart}` : countPart
}

/** Une tuile par série (jaquette de la série), avec le décompte de tomes
 * possédés en sous-titre - voir seriesSubtitle. Une Entity sans Variant
 * (pas de notion de "tome") n'affiche que sa jaquette, sans sous-titre. */
function groupBySeries(entities: EntityResponse[]): Tile[] {
  return entities.map((entity) => ({
    key: entity.id,
    title: entity.title,
    subtitle: entity.variants.length > 0 ? seriesSubtitle(entity) : undefined,
    imageUrl: coverImageUrlFrom(entity.attributes),
    entityId: entity.id,
  }))
}

export function ShelfPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [username, setUsername] = useState('')
  // Repliée par défaut (un tome = une tuile, avec sa propre jaquette) - voir
  // la demande explicite "afficher chacun des tomes... par défaut". Le
  // regroupement par série est une option, pas l'inverse.
  const [grouped, setGrouped] = useState(false)

  // Sans paramètre, /entities/search renvoie toute la collection - c'est
  // notre "liste complète" pour l'étagère (pas de cache offline séparé,
  // contrairement à l'iOS : TanStack Query fait office de cache mémoire).
  const entitiesQuery = useQuery({
    queryKey: queryKeys.entities.search({}),
    queryFn: () => searchEntities({}),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })

  const importMutation = useMutation({
    mutationFn: importBggCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      setImportOpen(false)
      setUsername('')
    },
  })

  const entities = entitiesQuery.data ?? EMPTY_ENTITIES
  const entityTypes = entityTypesQuery.data ?? EMPTY_ENTITY_TYPES

  // "Retrouver les jaquettes manquantes" - voir backfillCovers.ts. Réutilise
  // GET /metadata/volumes (VolumeSelectionGrid côté Ajout rapide) qui met en
  // cache son résultat côté backend : pour une série déjà recherchée à
  // l'ajout (le cas le plus courant), un premier essai SANS forceRefresh ne
  // consomme aucun quota Google Books supplémentaire. Mais ce cache peut
  // avoir été rempli SANS jaquette pour tel tome précis (Google Books
  // n'indexe pas toujours de miniature) - sans un vrai nouvel essai, le
  // bouton rejouait indéfiniment ce même échec ("Aucune jaquette retrouvée
  // cette fois" à chaque clic, y compris des mois plus tard). Voir
  // backfillMissingCovers ci-dessous : un forceRefresh n'est déclenché
  // qu'en second recours, uniquement pour les tomes encore sans jaquette
  // après le premier essai gratuit - jamais pour une série déjà complète.
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
        // Le cache (essai gratuit ci-dessus) peut dater d'une recherche où
        // Google Books n'avait justement pas de jaquette pour CE tome précis
        // - un vrai nouvel essai (forceRefresh) est la seule façon de savoir
        // si ça a changé depuis, plutôt que de reproduire indéfiniment le
        // même échec. Coûte du quota réel, mais seulement pour les séries
        // qui en ont encore besoin après le premier passage gratuit.
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
  // d'origine (n'avait de sens qu'avec exactement 3 types codés en dur) -
  // un type sans aucune Entity n'apparaît pas.
  //
  // Compte le nombre de TUILES (flattenToTomes/groupBySeries, jamais
  // entities.length brut) pour rester exactement cohérent avec ce que la
  // grille affiche selon le mode courant - sinon les cartes en haut de page
  // ("Manga : 2") comptaient les séries même en vue par tome, contredisant
  // visiblement la grille juste en dessous (3 tuiles pour "2"). Voir l'audit
  // "on mélange tome et série" - même principe que StatsPage "Par type".
  const countsByType = useMemo(
    () =>
      entityTypes
        .map((type) => {
          const entitiesOfType = entities.filter((e) => e.entityTypeId === type.id)
          const count = grouped ? entitiesOfType.length : flattenToTomes(entitiesOfType).length
          return { type, count }
        })
        .filter((entry) => entry.count > 0),
    [entities, entityTypes, grouped],
  )

  const visibleEntities = selectedTypeId
    ? entities.filter((e) => e.entityTypeId === selectedTypeId)
    : entities

  const tiles = useMemo(
    () => (grouped ? groupBySeries(visibleEntities) : flattenToTomes(visibleEntities)),
    [grouped, visibleEntities],
  )
  const totalCount = grouped ? entities.length : flattenToTomes(entities).length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Ma collection</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/types')}
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-textDim hover:text-textPrimary"
          >
            <Settings size={16} />
            Gérer les types
          </button>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-textDim hover:text-textPrimary"
          >
            <Upload size={16} />
            Importer depuis BGG
          </button>
        </div>
      </div>

      {importOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (username.trim()) importMutation.mutate(username.trim())
          }}
          className="flex gap-2 rounded-2xl bg-surface p-3"
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Pseudo BoardGameGeek"
            className="flex-1 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="submit"
            disabled={importMutation.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accentText disabled:opacity-50"
          >
            {importMutation.isPending ? 'Import...' : 'Importer'}
          </button>
        </form>
      )}
      {importMutation.isError && <ErrorBanner message={importMutation.error.message} />}
      {importMutation.isSuccess && (
        <p className="text-sm text-textDim">
          {importMutation.data.created} créé(s), {importMutation.data.matchedExisting} déjà possédé(s) sur{' '}
          {importMutation.data.totalFound} trouvé(s).
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto">
        <StatCard value={String(totalCount)} label="Total" />
        {countsByType.map((entry) => (
          <StatCard key={entry.type.id} value={String(entry.count)} label={entry.type.label} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypeFilterChips entityTypes={entityTypes} selectedTypeId={selectedTypeId} onChange={setSelectedTypeId} />
        <Chip label="Grouper par série" isActive={grouped} onClick={() => setGrouped((v) => !v)} />
      </div>

      {!grouped && entitiesMissingCovers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={backfillMissingCovers}
            disabled={backfill?.running}
            className="flex w-fit items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-textDim hover:text-textPrimary disabled:opacity-50"
          >
            {backfill?.running ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {backfill?.running
              ? `Recherche des jaquettes... (${backfill.processed}/${backfill.total} séries)`
              : 'Retrouver les jaquettes manquantes'}
          </button>
          {backfill && !backfill.running && (
            <p className="text-xs text-textDim">
              {backfill.found > 0
                ? `${backfill.found} jaquette${backfill.found > 1 ? 's' : ''} retrouvée${backfill.found > 1 ? 's' : ''}.`
                : 'Aucune jaquette retrouvée cette fois.'}
              {backfill.quotaExceeded &&
                ` Quota Google Books dépassé - ${backfill.processed}/${backfill.total} séries traitées, réessaie plus tard pour les autres.`}
            </p>
          )}
        </div>
      )}

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}

      {entitiesQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {entitiesQuery.isSuccess && visibleEntities.length === 0 && (
        <p className="text-textDim">
          Rien ici pour l'instant - utilise l'onglet "Ajouter" pour commencer ta collection.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
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
