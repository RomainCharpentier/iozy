import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { listEntityTypes, deleteEntityType } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { ApiError } from '@/common/api/client'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { iconFor } from '@/common/theme/icon'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { Squelette } from '@/common/components/Squelette'

/** Dynamic type editor: list of the collection categories (the
 * 3 historical MVP types + any type created by the user). Reachable
 * from Paramètres > Administration avancée (see AdministrationPage) -
 * no 6th tab in the TabBar, technical configuration touched once
 * then forgotten, not a tool consulted at every session. */
export function EntityTypesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** The type whose deletion is waiting for confirmation - same idiom as
   * EditionsPage: an inline panel, under the concerned row, rather than a
   * window.confirm torn out of the application theme. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteEntityType,
    onSuccess: () => {
      setErrorMessage(null)
      setConfirmingId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.entityTypes.all })
    },
    onError: (error, id) => {
      // The panel closes: the error message lives at the top of the page, it
      // would stay hidden behind a confirmation that is still open.
      setConfirmingId(null)
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
      <LienRetour parDefaut={{ to: '/administration', libelle: 'Administration' }} />

      <EnTeteSection
        niveau={1}
        titre="Gérer les types"
        action={
          <button
            type="button"
            onClick={() => navigate('/types/new')}
            className="btn-primaire"
          >
            <Plus size={16} />
            Nouveau type
          </button>
        }
      />

      {errorMessage && <ErrorBanner message={errorMessage} />}
      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}
      {entityTypesQuery.isLoading && <Squelette lignes={3} />}

      {/* Without it, someone who deleted their types saw a title, a button,
          and nothing between the two - a page that looks unfinished rather than
          empty. The case is reachable: the three starting types can be
          deleted. */}
      {entityTypesQuery.isSuccess && entityTypesQuery.data.length === 0 && (
        <p className="text-textDim">
          Aucun type pour l'instant. Un type, c'est ce que tu collectionnes — manga, jeu vidéo, jeu de
          société — et c'est lui qui décide des champs d'une fiche. Crée-en un pour commencer.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {(entityTypesQuery.data ?? []).map((type) => {
          const Icon = iconFor(type.code)
          return (
            <li key={type.id} className="flex flex-col gap-2 rounded-xl bg-surface p-3">
              <div className="flex items-center gap-3">
                <Icon size={20} className="shrink-0 text-accentText" />
                <button
                  type="button"
                  onClick={() => navigate(`/types/${type.id}/edit`)}
                  className="flex min-h-11 flex-1 flex-col justify-center text-left"
                >
                  <p className="text-sm font-medium text-textPrimary">{type.label}</p>
                  <p className="text-xs text-textDim">{type.code}</p>
                </button>
                {/* Opens the confirmation, no longer deletes directly: the
                    trash can is one finger away from the edit button that takes
                    the whole row, and a deletion went through at the first click
                    without asking anything or leaving anything to undo. */}
                <button
                  type="button"
                  onClick={() => setConfirmingId(confirmingId === type.id ? null : type.id)}
                  aria-expanded={confirmingId === type.id}
                  aria-label={`Supprimer le type ${type.label}`}
                  title={`Supprimer le type ${type.label}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-textDim hover:bg-dangerTint hover:text-dangerText"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {confirmingId === type.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-dangerTint p-2.5">
                  <p className="flex-1 text-xs text-textPrimary">
                    Supprimer « {type.label} » ? Sa couleur, son icône, ses champs personnalisés et ses types
                    d'expérience seront perdus. Un type encore utilisé par des éléments de ta collection ne peut pas
                    être supprimé.
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(type.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-dangerInk disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg px-2 py-1.5 text-xs text-textDim"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
