import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ListOrdered, Plus } from 'lucide-react'
import { listEntityTypes } from '../../api/entityTypes'
import { getGeneralBoard, listTierLists } from '../../api/tierLists'
import { queryKeys } from '../../lib/queryKeys'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CreateTierListModal } from './CreateTierListModal'
import { TierBadge } from './TierBadge'
import { boardCounts, boardPreviewRows } from '../../lib/tierListVisuals'
import type { TierListDto } from '../../types/tierList'

/**
 * Écran "Tier Lists" à part entière - "deuxième grande expérience, à côté
 * de la collection" (voir DS v1.1, commentaire source ligne ~1100), atteint
 * depuis Découvrir (aperçu compact, voir DiscoverTierPreview) ou depuis la
 * fiche d'une œuvre ("Toutes mes Tier Lists", voir TomesGridSection). Un
 * classement général par univers réellement possédé + les Tier Lists
 * personnalisées de chaque univers + un point d'entrée de création par
 * univers - jamais un flux générique qui mélangerait les univers (une Tier
 * List perso appartient à exactement un type de collection dans ce modèle ;
 * une liste transverse "tous types" façon maquette n'est pas supportée par
 * le schéma actuel - TierList.entityTypeId est une FK non nulle - extension
 * additive possible plus tard, non prioritaire tant qu'un seul univers a du
 * contenu réel). Univers sans aucune œuvre possédée ET sans aucune Tier
 * List perso masqué (même principe que groupByEntityType côté Ma
 * collection - jamais une section vide).
 */
export function TierListsScreen() {
  const navigate = useNavigate()
  const [creatingFor, setCreatingFor] = useState<{ id: string; label: string } | null>(null)

  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const entityTypes = entityTypesQuery.data ?? []

  const boardQueries = useQueries({
    queries: entityTypes.map((t) => ({
      queryKey: queryKeys.tierLists.general(t.id),
      queryFn: () => getGeneralBoard(t.id),
    })),
  })
  const listsQueries = useQueries({
    queries: entityTypes.map((t) => ({
      queryKey: queryKeys.tierLists.custom(t.id),
      queryFn: () => listTierLists(t.id),
    })),
  })

  if (entityTypesQuery.isError) return <ErrorBanner message={entityTypesQuery.error.message} />
  if (entityTypesQuery.isLoading) return <p className="text-textDim">Chargement...</p>

  const stillLoading = boardQueries.some((q) => q.isLoading) || listsQueries.some((q) => q.isLoading)
  if (stillLoading) return <p className="text-textDim">Chargement...</p>

  const sections = entityTypes
    .map((entityType, i) => ({
      entityType,
      board: boardQueries[i].data,
      counts: boardCounts(boardQueries[i].data),
      lists: listsQueries[i].data ?? ([] as TierListDto[]),
    }))
    .filter((s) => s.counts.total > 0 || s.lists.length > 0)

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate('/discover')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Découvrir
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Tier Lists</h1>
        {sections.length > 0 && (
          <button
            type="button"
            onClick={() => setCreatingFor({ id: sections[0].entityType.id, label: sections[0].entityType.label })}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accentText"
          >
            <Plus size={16} />
            Nouvelle Tier List
          </button>
        )}
      </div>

      {sections.length === 0 && (
        <div className="rounded-2xl border border-surface2 bg-surface p-8 text-center">
          <p className="font-display text-base font-semibold text-textPrimary">Rien à classer pour l'instant</p>
          <p className="mt-1.5 text-sm text-textDim">Ajoute des œuvres à ta collection pour commencer à les classer.</p>
        </div>
      )}

      {sections.map(({ entityType, board, counts, lists }) => {
        const visual = getEntityTypeVisual(entityType.code)
        const preview = boardPreviewRows(board)
        return (
          <div key={entityType.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
                <h2 className="font-display text-base font-semibold text-textPrimary">{entityType.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setCreatingFor({ id: entityType.id, label: entityType.label })}
                className="text-xs font-semibold text-accentText"
              >
                + Nouvelle liste
              </button>
            </div>

            {counts.total > 0 && (
              <Link
                to={`/tier-lists/general/${entityType.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-surface2 bg-surface p-4 shadow-token-sm transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2.5">
                  <ListOrdered size={16} className="text-textDim" />
                  <span className="text-sm font-semibold text-textPrimary">Classement général</span>
                </div>
                {preview.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {preview.map((row) => (
                      <div key={row.rank} className="flex items-center gap-2">
                        <TierBadge rank={row.rank} size="compact" />
                        <div className="flex gap-1">
                          {row.covers.map((cover, i) =>
                            cover ? (
                              <img key={i} src={cover} alt="" className="h-8 w-6 shrink-0 rounded object-cover" />
                            ) : (
                              <span key={i} className="h-8 w-6 shrink-0 rounded bg-surface2" />
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-textDim">Rien de classé pour l'instant.</p>
                )}
                <p className="text-xs text-textDim">
                  {counts.ranked} classé{counts.ranked > 1 ? 's' : ''} · {counts.total - counts.ranked} à classer
                </p>
              </Link>
            )}

            {lists.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl border border-surface2 bg-surface p-2 shadow-token-sm">
                {lists.map((list) => (
                  <Link
                    key={list.id}
                    to={`/tier-lists/${list.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl p-2.5 transition-colors hover:bg-rowHover"
                  >
                    <span className="truncate text-sm font-semibold text-textPrimary">{list.name}</span>
                    <span className="shrink-0 text-xs text-textDim">
                      {list.rankedCount}/{list.itemCount}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {creatingFor && (
        <CreateTierListModal
          entityTypeId={creatingFor.id}
          entityTypeLabel={creatingFor.label}
          onClose={() => setCreatingFor(null)}
        />
      )}
    </div>
  )
}
