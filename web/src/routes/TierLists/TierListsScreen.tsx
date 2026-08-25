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
import { TexteCoupe } from '../../components/TexteCoupe'
import { Jaquette } from '../../components/Jaquette'

/**
 * Écran "Tier Lists" à part entière - "deuxième grande expérience, à côté
 * de la collection" (voir DS v1.1, commentaire source ligne ~1100), atteint
 * depuis Découvrir (aperçu compact, voir DiscoverTierPreview) ou depuis la
 * fiche d'une œuvre ("Toutes mes Tier Lists", voir TomesGridSection). Un
 * classement général par univers réellement possédé + les Tier Lists
 * personnalisées de chaque univers + un point d'entrée de création par
 * univers. Les Tier Lists TRANSVERSES "toutes catégories" (scope 'all' de la
 * maquette, Lot 14) forment leur propre famille en fin d'écran plutôt que
 * d'apparaître sous chaque univers : elles n'appartiennent à aucun, les
 * répéter partout les afficherait autant de fois qu'il y a de types.
 * Univers sans aucune œuvre possédée ET sans aucune Tier List perso masqué
 * (même principe que groupByEntityType côté Ma collection - jamais une
 * section vide) ; la famille transverse suit la même règle, absente tant
 * qu'aucune liste de ce genre n'existe.
 */
export function TierListsScreen() {
  const navigate = useNavigate()
  // null dans le state = modal fermée ; { id: null } = modal ouverte sur
  // "Toutes catégories" - deux "null" de sens différents, d'où l'objet.
  const [creatingFor, setCreatingFor] = useState<{ id: string | null } | null>(null)

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
  const crossUniverseQuery = useQuery({
    queryKey: queryKeys.tierLists.custom(null),
    queryFn: () => listTierLists(null),
  })

  // Pas de retour anticipé : l'écran garde son titre pendant qu'il charge.
  // Le remplacer entièrement par « Chargement... » lui faisait perdre son h1,
  // donc AUSSI le titre de son onglet (voir useDocumentTitle, qui lit le h1) -
  // l'onglet retombait sur « IozyCore » - et son seul repère de structure pour
  // un lecteur d'écran. Statistiques et Envies gardent déjà le leur : c'est
  // cette forme-là qui est majoritaire dans l'application.
  const chargement =
    entityTypesQuery.isLoading ||
    boardQueries.some((q) => q.isLoading) ||
    listsQueries.some((q) => q.isLoading) ||
    crossUniverseQuery.isLoading

  const sections = entityTypes
    .map((entityType, i) => ({
      entityType,
      board: boardQueries[i].data,
      counts: boardCounts(boardQueries[i].data),
      lists: listsQueries[i].data ?? ([] as TierListDto[]),
    }))
    .filter((s) => s.counts.total > 0 || s.lists.length > 0)

  const crossUniverseLists = crossUniverseQuery.data ?? ([] as TierListDto[])

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate('/discover')} className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Découvrir
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Tier Lists</h1>
        {sections.length > 0 && (
          <button
            type="button"
            onClick={() => setCreatingFor({ id: sections[0].entityType.id })}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk"
          >
            <Plus size={16} />
            Nouvelle Tier List
          </button>
        )}
      </div>

      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}
      {chargement && <p className="text-textDim">Chargement...</p>}

      {/* `!chargement` en garde : sans lui, l'état vide clignoterait à chaque
          ouverture, le temps que les données arrivent - « Rien à classer »
          affiché à quelqu'un qui a justement des choses à classer. */}
      {!chargement && sections.length === 0 && (
        <div className="rounded-2xl border border-surface2 bg-surface p-8 text-center">
          <p className="font-display text-base font-semibold text-textPrimary">Rien à classer pour l'instant</p>
          <p className="mt-1.5 text-sm text-textDim">Ajoute des œuvres à ta collection pour commencer à les classer.</p>
        </div>
      )}

      {sections.map(({ entityType, board, counts, lists }) => {
        const visual = getEntityTypeVisual(entityType)
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
                onClick={() => setCreatingFor({ id: entityType.id })}
                className="inline-flex min-h-11 items-center text-xs font-semibold text-accentText"
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
                          {row.covers.map((cover, i) => (
                            <Jaquette
                              key={i}
                              src={cover}
                              className="h-8 w-6 shrink-0 rounded object-cover"
                              repli={<span className="h-8 w-6 shrink-0 rounded bg-surface2" />}
                            />
                          ))}
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
                    <TexteCoupe texte={list.name} className="truncate text-sm font-semibold text-textPrimary" />
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

      {(crossUniverseLists.length > 0 || sections.length > 0) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-lineStrong" />
              <h2 className="font-display text-base font-semibold text-textPrimary">Toutes catégories</h2>
            </div>
            <button type="button" onClick={() => setCreatingFor({ id: null })} className="inline-flex min-h-11 items-center text-xs font-semibold text-accentText">
              + Nouvelle liste
            </button>
          </div>

          {crossUniverseLists.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-surface2 bg-surface p-2 shadow-token-sm">
              {crossUniverseLists.map((list) => (
                <Link
                  key={list.id}
                  to={`/tier-lists/${list.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 transition-colors hover:bg-rowHover"
                >
                  <TexteCoupe texte={list.name} className="truncate text-sm font-semibold text-textPrimary" />
                  <span className="shrink-0 text-xs text-textDim">
                    {list.rankedCount}/{list.itemCount}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-textDim">
              Une Tier List qui mélange les univers — comparer un manga et un jeu dans le même classement.
            </p>
          )}
        </div>
      )}

      {creatingFor && <CreateTierListModal entityTypeId={creatingFor.id} onClose={() => setCreatingFor(null)} />}
    </div>
  )
}
