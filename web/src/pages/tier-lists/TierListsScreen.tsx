import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ListOrdered, Plus } from 'lucide-react'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CreateTierListModal } from './CreateTierListModal'
import { TierBadge } from '@/common/components/TierBadge'
import { boardPreviewRows } from '@/common/lib/tierListVisuals'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { EtatVide } from '@/common/components/EtatVide'
import { useDonneesTierLists } from '@/common/hooks/useDonneesTierLists'
import { Squelette } from '@/common/components/Squelette'

/**
 * "Tier Lists" screen in its own right - "second big experience, next
 * to the collection" (see DS v1.1, source comment line ~1100), reached
 * from Découvrir (compact preview, see DiscoverTierPreview) or from the
 * detail page of a work ("Toutes mes Tier Lists", see TomesGridSection). A
 * general ranking per universe that is really owned + the custom Tier Lists
 * of each universe + a creation entry point per
 * universe. The CROSS-CATEGORY "toutes catégories" Tier Lists (scope 'all' of the
 * mockup, batch 14) form their own family at the end of the screen rather than
 * appearing under each universe: they belong to none, repeating
 * them everywhere would show them as many times as there are types.
 * A universe without any owned work AND without any custom Tier List is hidden
 * (same principle as groupByEntityType on the Ma collection side - never an
 * empty section); the cross-category family follows the same rule, absent as long
 * as no list of this kind exists.
 */
export function TierListsScreen() {
  const navigate = useNavigate()
  // null in the state = modal closed; { id: null } = modal open on
  // "Toutes catégories" - two "null" of different meaning, hence the object.
  const [creatingFor, setCreatingFor] = useState<{ id: string | null } | null>(null)

  const donnees = useDonneesTierLists()

  // No early return: the screen keeps its title while it loads.
  // Replacing it entirely with "Chargement..." made it lose its h1,
  // therefore ALSO the title of its tab (see useDocumentTitle, which reads the h1) -
  // the tab fell back on "IozyCore" - and its only structure landmark for
  // a screen reader. Statistiques and Envies already keep theirs: this
  // form is the majority one in the application.
  const chargement = donnees.chargement

  const sections = donnees.univers
    .map((u) => ({ entityType: u.entityType, board: u.board, counts: u.counts, lists: u.listes }))
    .filter((s) => s.counts.total > 0 || s.lists.length > 0)

  const crossUniverseLists = donnees.listesTransverses

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate('/discover')} className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Découvrir
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <EnTeteSection
          niveau={1}
          titre="Tier Lists"
          className="flex-1"
          action={
            sections.length > 0 && (
              <button
                type="button"
                onClick={() => setCreatingFor({ id: sections[0].entityType.id })}
                className="btn-primaire"
              >
                <Plus size={16} />
                Nouvelle Tier List
              </button>
            )
          }
        />
      </div>

      {donnees.erreur && <ErrorBanner message={donnees.erreur} />}
      {chargement && <Squelette lignes={3} />}

      {/* `!chargement` as a guard: without it, the empty state would blink at each
          opening, while the data arrives - "Rien à classer"
          shown to someone who precisely has things to rank. */}
      {!chargement && sections.length === 0 && (
        <EtatVide
          icone={ListOrdered}
          titre="Rien à classer pour l'instant"
          detail="Ajoute des œuvres à ta collection pour commencer à les classer."
        />
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
