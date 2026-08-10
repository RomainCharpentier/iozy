import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Upload } from 'lucide-react'
import { searchEntities } from '../../api/entities'
import { importBggCollection } from '../../api/metadata'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { CoverTile } from '../../components/CoverTile'
import { Chip } from '../../components/Chip'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { totalVolumesFrom, isSeriesOngoing } from '../../lib/seriesInfo'
import { StatCard } from '../../components/StatCard'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TypeFilterChips } from './TypeFilterChips'
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
  entityId: string
}

/** "Tome 12" si un numéro de tome est exploitable (voir QuickAddService côté
 * backend, attribut "volumeNumber" du Variant), sinon le label brut du
 * Variant (ex: un ajout plus ancien, sans ce numéro structuré). */
function variantSubtitle(variant: VariantDto): string {
  const volumeNumber = variant.attributes.volumeNumber
  return typeof volumeNumber === 'number' ? `Tome ${volumeNumber}` : variant.label
}

/** Une tuile par tome (jaquette du tome si connue, sinon celle de la série)
 * - jamais une par série : voir la demande "afficher chacun des tomes avec
 * les bonnes illustrations". Une Entity sans Variant (jeu vidéo, jeu de
 * société, ou manga ajouté sans préciser de tome) garde une tuile unique. */
function flattenToTomes(entities: EntityResponse[]): Tile[] {
  const tiles: Tile[] = []
  for (const entity of entities) {
    if (entity.variants.length === 0) {
      tiles.push({ key: entity.id, title: entity.title, imageUrl: coverImageUrlFrom(entity.attributes), entityId: entity.id })
      continue
    }
    for (const variant of entity.variants) {
      tiles.push({
        key: variant.id,
        title: entity.title,
        subtitle: variantSubtitle(variant),
        imageUrl: coverImageUrlFrom(variant.attributes) ?? coverImageUrlFrom(entity.attributes),
        entityId: entity.id,
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

  // Généralisé en un compte par type plutôt que le bucket fixe "Mangas/Jeux"
  // d'origine (n'avait de sens qu'avec exactement 3 types codés en dur) -
  // un type sans aucune Entity n'apparaît pas.
  const countsByType = useMemo(
    () =>
      entityTypes
        .map((type) => ({ type, count: entities.filter((e) => e.entityTypeId === type.id).length }))
        .filter((entry) => entry.count > 0),
    [entities, entityTypes],
  )

  const visibleEntities = selectedTypeId
    ? entities.filter((e) => e.entityTypeId === selectedTypeId)
    : entities

  const tiles = useMemo(
    () => (grouped ? groupBySeries(visibleEntities) : flattenToTomes(visibleEntities)),
    [grouped, visibleEntities],
  )

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
        <StatCard value={String(entities.length)} label="Total" />
        {countsByType.map((entry) => (
          <StatCard key={entry.type.id} value={String(entry.count)} label={entry.type.label} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <TypeFilterChips entityTypes={entityTypes} selectedTypeId={selectedTypeId} onChange={setSelectedTypeId} />
        <Chip label="Grouper par série" isActive={grouped} onClick={() => setGrouped((v) => !v)} />
      </div>

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
            onClick={() => navigate(`/entity/${tile.entityId}`)}
          />
        ))}
      </div>
    </div>
  )
}
