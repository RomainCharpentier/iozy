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
  /** Le type dont la suppression attend confirmation - même idiome que
   * EditionsPage : un panneau en ligne, sous la ligne concernée, plutôt qu'un
   * window.confirm arraché au thème de l'application. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: deleteEntityType,
    onSuccess: () => {
      setErrorMessage(null)
      setConfirmingId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.entityTypes.all })
    },
    onError: (error, id) => {
      // Le panneau se referme : le message d'erreur vit en haut de page, il
      // resterait caché derrière une confirmation encore ouverte.
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
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Gérer les types</h1>
        <button
          type="button"
          onClick={() => navigate('/types/new')}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-3 text-sm font-semibold text-accentInk"
        >
          <Plus size={16} />
          Nouveau type
        </button>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} />}
      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}
      {entityTypesQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {/* Sans ça, quelqu'un qui a supprimé ses types voyait un titre, un bouton,
          et rien entre les deux - une page qui a l'air inachevée plutôt que
          vide. Le cas est atteignable : les trois types de départ se
          suppriment. */}
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
                {/* Ouvre la confirmation, ne supprime plus directement : la
                    corbeille est à un doigt du bouton d'édition qui occupe
                    toute la ligne, et une suppression partait au premier clic
                    sans rien demander ni rien laisser annuler. */}
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
