import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Settings, Upload } from 'lucide-react'
import { searchEntities } from '../../api/entities'
import { importBggCollection } from '../../api/metadata'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { CoverTile } from '../../components/CoverTile'
import { StatCard } from '../../components/StatCard'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TypeFilterChips } from './TypeFilterChips'
import { useNavigate } from 'react-router-dom'
import type { EntityResponse, EntityTypeDto } from '../../types/api'

// Référence stable pour le fallback "pas encore chargé" - un `[]` inline
// serait recréé à chaque render et invaliderait la mémoïsation de `counts`.
const EMPTY_ENTITIES: EntityResponse[] = []
const EMPTY_ENTITY_TYPES: EntityTypeDto[] = []

export function ShelfPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [username, setUsername] = useState('')

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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Tes étagères</h1>
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
            className="flex-1 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
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

      <TypeFilterChips entityTypes={entityTypes} selectedTypeId={selectedTypeId} onChange={setSelectedTypeId} />

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}

      {entitiesQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {entitiesQuery.isSuccess && visibleEntities.length === 0 && (
        <p className="text-textDim">
          Rien ici pour l'instant - utilise l'onglet "Ajouter" pour commencer ta collection.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {visibleEntities.map((entity) => (
          <CoverTile key={entity.id} title={entity.title} onClick={() => navigate(`/entity/${entity.id}`)} />
        ))}
      </div>
    </div>
  )
}
