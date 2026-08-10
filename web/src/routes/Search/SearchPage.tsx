import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon, ShieldQuestion } from 'lucide-react'
import { searchEntities } from '../../api/entities'
import { addToWishlist, lookupWishlistStatus } from '../../api/wishlist'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { ErrorBanner } from '../../components/ErrorBanner'
import { StatusPill } from '../../components/StatusPill'

export function SearchPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  // Statut vérifié seulement pour la ligne sélectionnée, pas pour tous les
  // résultats en parallèle à chaque frappe (coûteux et inutile).
  const [checkedId, setCheckedId] = useState<string | null>(null)

  const debouncedQuery = useDebouncedValue(query, 300)

  const resultsQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: debouncedQuery }),
    queryFn: () => searchEntities({ q: debouncedQuery }),
    enabled: debouncedQuery.trim().length > 0,
  })

  const lookupQuery = useQuery({
    queryKey: queryKeys.wishlist.lookup(checkedId ?? ''),
    queryFn: () => lookupWishlistStatus(checkedId!),
    enabled: !!checkedId,
  })

  const addMutation = useMutation({
    mutationFn: addToWishlist,
    onSuccess: (_data, entityId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.lookup(entityId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Recherche</h1>

      <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
        <SearchIcon size={16} className="text-textDim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un titre..."
          className="w-full bg-transparent text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          autoFocus
        />
      </div>

      {resultsQuery.isError && <ErrorBanner message={resultsQuery.error.message} />}

      {resultsQuery.isSuccess && resultsQuery.data.length === 0 && (
        <p className="text-textDim">Aucun résultat pour "{debouncedQuery}".</p>
      )}

      <ul className="flex flex-col gap-2">
        {(resultsQuery.data ?? []).map((entity) => (
          <li key={entity.id} className="rounded-xl bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => navigate(`/entity/${entity.id}`)}
                className="text-left text-sm font-medium text-textPrimary hover:text-accent"
              >
                {entity.title}
              </button>
              <button
                type="button"
                onClick={() => setCheckedId(entity.id)}
                className="flex shrink-0 items-center gap-1 text-xs font-medium text-textDim hover:text-textPrimary"
              >
                <ShieldQuestion size={14} />
                Vérifier
              </button>
            </div>

            {checkedId === entity.id && (
              <div className="mt-2 flex items-center gap-2">
                {lookupQuery.isLoading && <span className="text-xs text-textDim">Vérification...</span>}
                {lookupQuery.data && <StatusPill status={lookupQuery.data.status} />}
                {lookupQuery.data?.status === 'UNKNOWN' && (
                  <button
                    type="button"
                    onClick={() => addMutation.mutate(entity.id)}
                    disabled={addMutation.isPending}
                    className="rounded-full bg-surface2 px-3 py-1 text-xs font-medium text-textPrimary disabled:opacity-50"
                  >
                    Ajouter à la wishlist
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
