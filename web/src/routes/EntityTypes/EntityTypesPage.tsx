import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { listEntityTypes, deleteEntityType } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ApiError } from '../../api/client'
import { ErrorBanner } from '../../components/ErrorBanner'
import { iconFor } from '../../theme/icon'

/** Éditeur de types dynamique : liste des catégories de la collection (les
 * 3 types MVP historiques + tout type créé par l'utilisateur). Accessible
 * depuis Paramètres > Administration avancée (voir AdministrationPage) -
 * pas de 6e onglet dans la TabBar, configuration technique touchée une fois
 * puis oubliée, pas un outil consulté à chaque session. */
export function EntityTypesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteEntityType,
    onSuccess: () => {
      setErrorMessage(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.entityTypes.all })
    },
    onError: (error, id) => {
      const type = entityTypesQuery.data?.find((t) => t.id === id)
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage(
          `« ${type?.label ?? 'Ce type'} » est encore utilisé par des éléments de ta collection - impossible à supprimer.`,
        )
      } else {
        setErrorMessage(`Échec de la suppression de « ${type?.label ?? 'ce type'} ».`)
      }
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Gérer les types</h1>
        <button
          type="button"
          onClick={() => navigate('/types/new')}
          className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accentText"
        >
          <Plus size={16} />
          Nouveau type
        </button>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} />}
      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}
      {entityTypesQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      <ul className="flex flex-col gap-2">
        {(entityTypesQuery.data ?? []).map((type) => {
          const Icon = iconFor(type.code)
          return (
            <li key={type.id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <Icon size={20} className="shrink-0 text-accent" />
              <button
                type="button"
                onClick={() => navigate(`/types/${type.id}/edit`)}
                className="flex-1 text-left"
              >
                <p className="text-sm font-medium text-textPrimary">{type.label}</p>
                <p className="text-xs text-textDim">{type.code}</p>
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(type.id)}
                disabled={deleteMutation.isPending}
                className="shrink-0 rounded-lg p-2 text-textDim hover:text-pink disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
