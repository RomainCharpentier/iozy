import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { searchEntities } from '../../api/entities'
import { listAllOwnerships } from '../../api/ownerships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { CoverTile } from '../../components/CoverTile'
import { ErrorBanner } from '../../components/ErrorBanner'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { buildShelfTile, matchesCompletionFilter, type CompletionFilter } from './shelfTiles'
import { CollectionFilters } from './CollectionFilters'
import { ownedVariantIds, isOwned } from './ownership'
import type { EntityResponse, EntityTypeDto, OwnershipResponse } from '../../types/api'

const EMPTY_ENTITIES: EntityResponse[] = []
const EMPTY_ENTITY_TYPES: EntityTypeDto[] = []
const EMPTY_OWNERSHIPS: OwnershipResponse[] = []

/** "Vue catégorie" (voir la maquette V1.2) - la grille complète d'un seul
 * type, accessible via "Tout voir" depuis une ligne de Ma collection. Même
 * filtre d'état que ShelfPage (voir CollectionFilters), propre à cette
 * page : filtrer "Incomplètes" ici ne doit pas affecter les autres rails
 * quand on revient en arrière. */
export function CategoryPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [status, setStatus] = useState<CompletionFilter>('ALL')

  const entitiesQuery = useQuery({ queryKey: queryKeys.entities.search({}), queryFn: () => searchEntities({}) })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const ownershipsQuery = useQuery({ queryKey: queryKeys.allOwnerships, queryFn: listAllOwnerships })

  const allEntities = entitiesQuery.data ?? EMPTY_ENTITIES
  const entityTypes = entityTypesQuery.data ?? EMPTY_ENTITY_TYPES
  const ownerships = ownershipsQuery.data ?? EMPTY_OWNERSHIPS
  const owned = useMemo(() => ownedVariantIds(ownerships), [ownerships])
  const entityType = entityTypes.find((t) => t.id === entityTypeId)
  const visual = getEntityTypeVisual(entityType?.code)

  const entities = useMemo(
    () =>
      allEntities.filter(
        (e) => e.entityTypeId === entityTypeId && isOwned(e, ownerships, owned) && matchesCompletionFilter(e, owned, status),
      ),
    [allEntities, entityTypeId, ownerships, owned, status],
  )
  const tiles = useMemo(() => entities.map((e) => buildShelfTile(e, owned)), [entities, owned])

  const isLoading = entitiesQuery.isLoading || ownershipsQuery.isLoading

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate('/')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Ma collection
      </button>

      <div className="flex items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold" style={{ color: entityType ? visual.color : undefined }}>
          {entityType?.label ?? '…'}
        </h1>
        <span className="text-sm text-faint">{tiles.length}</span>
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-expanded={filtersOpen}
        className={`flex w-fit min-h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
          status !== 'ALL' ? 'border-transparent bg-accentTint text-accentText' : 'border-fieldBorder text-textDim hover:bg-rowHover'
        }`}
      >
        <SlidersHorizontal size={15} />
        Filtres
        {status !== 'ALL' && (
          <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentInk">
            1
          </span>
        )}
      </button>

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}
      {ownershipsQuery.isError && <ErrorBanner message={ownershipsQuery.error.message} />}
      {isLoading && <p className="text-textDim">Chargement...</p>}

      {!isLoading && entitiesQuery.isSuccess && tiles.length === 0 && (
        <div className="rounded-2xl border border-surface2 bg-surface p-6">
          <p className="font-display text-base font-semibold text-textPrimary">Aucune série ne correspond à ces filtres.</p>
          <button type="button" onClick={() => setStatus('ALL')} className="mt-3 w-fit text-sm font-semibold text-accentText">
            Réinitialiser les filtres
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5 2xl:grid-cols-6">
        {tiles.map((tile) => (
          <CoverTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            imageUrl={tile.imageUrl}
            gradientKey={tile.gradientKey}
            aspectClassName={visual.aspectClassName}
            signal={tile.signal}
            onClick={() => navigate(`/entity/${tile.entityId}`)}
          />
        ))}
      </div>

      <CollectionFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} status={status} onStatusChange={setStatus} />
    </div>
  )
}
