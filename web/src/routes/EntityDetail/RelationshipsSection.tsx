import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { searchEntities } from '../../api/entities'
import { createRelationship } from '../../api/relationships'
import { RelationshipRow } from './RelationshipRow'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { ErrorBanner } from '../../components/ErrorBanner'
import { RELATIONSHIP_TYPE_PRESETS } from '../../types/entityTypes'
import type { RelationshipDto } from '../../types/api'

interface RelationshipsSectionProps {
  entityId: string
  relationshipsFrom: RelationshipDto[]
  relationshipsTo: RelationshipDto[]
}

export function RelationshipsSection({ entityId, relationshipsFrom, relationshipsTo }: RelationshipsSectionProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [targetTitle, setTargetTitle] = useState('')
  const [relationshipType, setRelationshipType] = useState<string>(RELATIONSHIP_TYPE_PRESETS[0].value)
  const [customType, setCustomType] = useState('')

  const debouncedSearch = useDebouncedValue(search, 300)
  const suggestionsQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: debouncedSearch }),
    queryFn: () => searchEntities({ q: debouncedSearch }),
    enabled: debouncedSearch.trim().length >= 2,
  })

  const addMutation = useMutation({
    mutationFn: createRelationship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.relationships.from(entityId) })
      setFormOpen(false)
      setSearch('')
      setTargetId(null)
      setTargetTitle('')
      setCustomType('')
    },
  })

  const suggestions = (suggestionsQuery.data ?? []).filter((e) => e.id !== entityId)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-textPrimary">Relations</h2>
        <button type="button" onClick={() => setFormOpen((v) => !v)} className="text-sm font-medium text-accentText">
          Ajouter une relation
        </button>
      </div>

      {/* Les deux sens dans une seule liste, chacun explicitement étiqueté :
          une rangée de jaquettes les fondait ensemble et taisait le type,
          rendant une relation erronée à la fois invisible et incorrigible. */}
      {(relationshipsFrom.length > 0 || relationshipsTo.length > 0) && (
        <ul className="flex flex-col gap-2">
          {relationshipsFrom.map((relationship) => (
            <RelationshipRow
              key={relationship.id}
              relationship={relationship}
              direction="outgoing"
              entityId={entityId}
            />
          ))}
          {relationshipsTo.map((relationship) => (
            <RelationshipRow
              key={relationship.id}
              relationship={relationship}
              direction="incoming"
              entityId={entityId}
            />
          ))}
        </ul>
      )}

      {formOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!targetId) return
            addMutation.mutate({
              sourceEntityId: entityId,
              targetEntityId: targetId,
              relationshipType: customType.trim() || relationshipType,
            })
          }}
          className="flex flex-col gap-3 rounded-xl bg-surface p-3"
        >
          <div className="relative flex flex-col gap-1.5">
            <input
              value={targetId ? targetTitle : search}
              onChange={(e) => {
                setTargetId(null)
                setSearch(e.target.value)
              }}
              placeholder="Chercher une entité à lier..."
              className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {!targetId && suggestions.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-xl bg-surface2 p-2">
                {suggestions.map((entity) => (
                  <li key={entity.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetId(entity.id)
                        setTargetTitle(entity.title)
                      }}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-textPrimary hover:bg-surface"
                    >
                      {entity.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_TYPE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  setRelationshipType(preset.value)
                  setCustomType('')
                }}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  relationshipType === preset.value && !customType
                    ? 'bg-accent text-accentInk'
                    : 'bg-surface2 text-textDim'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="Ou un type personnalisé..."
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />

          <button
            type="submit"
            disabled={!targetId || addMutation.isPending}
            className="self-start rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accentInk disabled:opacity-50"
          >
            Créer
          </button>
          {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}
        </form>
      )}
    </section>
  )
}
