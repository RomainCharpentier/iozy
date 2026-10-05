import { useNavigate } from 'react-router-dom'
import { ChevronRight, Sparkles } from 'lucide-react'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { boardPreviewRows } from '@/common/lib/tierListVisuals'
import { TierBadge } from '@/common/components/TierBadge'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { useDonneesTierLists } from '@/common/hooks/useDonneesTierLists'
import { Squelette } from '@/common/components/Squelette'

const MAX_UNIVERSE_PREVIEWS = 2
const MAX_CUSTOM_PREVIEWS = 3

/**
 * "Tier Lists" panel of Découvrir (see DS v1.1 section 44) - compact PREVIEW,
 * not the full screen (see TierListsScreen on /tier-lists): at most 2
 * universes, at most 3 custom Tier Lists, each card opens a
 * board directly. A "front door" to Découvrir, not a repeat of the hub.
 */
export function DiscoverTierPreview() {
  const navigate = useNavigate()
  const donnees = useDonneesTierLists()

  if (donnees.erreur) return <ErrorBanner message={donnees.erreur} />
  if (donnees.chargement) return <Squelette lignes={3} />

  const universes = donnees.univers.filter((u) => u.counts.total > 0)

  const previewedUniverses = universes.slice(0, MAX_UNIVERSE_PREVIEWS)

  // The cross-category lists "toutes catégories" (batch 14) count like the
  // others in this preview: they belong to no universe, but
  // they are still custom Tier Lists of the user.
  const allCustomLists = donnees.toutesLesListes
  const previewedCustom = allCustomLists.slice(0, MAX_CUSTOM_PREVIEWS)

  const totalUnranked = universes.reduce((sum, u) => sum + (u.counts.total - u.counts.ranked), 0)
  // "Classer mes éléments" opens the general board that has the most waiting items,
  // and starts the quick ranking there (batch 14, see useQuickRank). Always
  // ONE single universe, never a multi-universe sequence: the general
  // ranking is by nature attached to a universe (see DS v1.1 section 45).
  const busiestUniverse = [...universes].sort((a, b) => b.counts.total - b.counts.ranked - (a.counts.total - a.counts.ranked))[0]

  if (universes.length === 0 && allCustomLists.length === 0) {
    return (
      <div className={`${CLASSE_CARTE} text-center`}>
        <p className="font-display text-base font-semibold text-textPrimary">Rien à classer pour l'instant</p>
        <p className="mt-1.5 text-sm text-textDim">Ajoute des œuvres à ta collection pour commencer à les classer.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* grid-cols-1 is not decorative. Without it, the grid has no
          declared column under 640px: the implicit track is then sized
          on the CONTENT, and the title in `truncate` (therefore nowrap) imposes its
          whole width on it instead of being cut. A type with a slightly long name
          pushed the card to 706px in a 375 window and made
          the whole page scroll horizontally. `grid-cols-1` equals
          repeat(1, minmax(0, 1fr)): the track can no longer overflow. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {previewedUniverses.map(({ entityType, board, counts }) => {
          const visual = getEntityTypeVisual(entityType)
          const preview = boardPreviewRows(board, 3, 4)
          return (
            <button
              key={entityType.id}
              type="button"
              onClick={() => navigate(`/tier-lists/general/${entityType.id}`, { state: { retour: { to: '/discover', libelle: 'Découvrir' } } })}
              className="flex flex-col gap-3 rounded-2xl border border-surface2 bg-surface p-4 text-left shadow-token-sm transition-transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: visual.tint }}>
                  <visual.icon size={16} style={{ color: visual.color }} />
                </span>
                <TexteCoupe texte={entityType.label} className="min-w-0 flex-1 truncate text-[15px] font-semibold text-textPrimary" />
                <ChevronRight size={16} className="shrink-0 text-textDim" />
              </span>
              {preview.length > 0 ? (
                <span className="flex flex-col gap-1.5">
                  {preview.map((row) => (
                    <span key={row.rank} className="flex items-center gap-1.5">
                      <TierBadge rank={row.rank} size="compact" />
                      <span className="flex gap-1">
                        {row.covers.map((cover, i) => (
                          <Jaquette
                            key={i}
                            src={cover}
                            className="h-[22px] w-4 shrink-0 rounded object-cover"
                            repli={<span className="h-[22px] w-4 shrink-0 rounded bg-surface2" />}
                          />
                        ))}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-textDim">Rien de classé pour l'instant.</span>
              )}
              <span className="text-xs text-textDim">
                {counts.ranked} classé{counts.ranked > 1 ? 's' : ''} · {counts.total - counts.ranked} à classer
              </span>
            </button>
          )
        })}
      </div>

      {previewedCustom.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previewedCustom.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => navigate(`/tier-lists/${list.id}`, { state: { retour: { to: '/discover', libelle: 'Découvrir' } } })}
              className="flex min-w-[210px] flex-1 items-center gap-2.5 rounded-2xl border border-surface2 bg-surface px-3.5 py-2.5 text-left transition-transform hover:-translate-y-0.5"
            >
              <TexteCoupe texte={list.name} className="min-w-0 flex-1 truncate text-sm font-semibold text-textPrimary" />
              <span className="shrink-0 text-xs text-textDim">
                {list.rankedCount}/{list.itemCount}
              </span>
            </button>
          ))}
        </div>
      )}

      {totalUnranked > 0 && busiestUniverse && (
        <button
          type="button"
          // Explicitly asks for the QUICK ranking, not just the opening
          // of the board (see GeneralTierBoardPage, state.quickRank): "Classer
          // mes éléments" promises to chain, not to reopen the selector
          // work by work by hand.
          onClick={() => navigate(`/tier-lists/general/${busiestUniverse.entityType.id}`, { state: { quickRank: true, ...({ retour: { to: '/discover', libelle: 'Découvrir' } }) } })}
          className="flex w-full items-center gap-3 rounded-2xl bg-accentTint p-3.5 text-left transition-transform hover:-translate-y-0.5"
        >
          <Sparkles size={18} className="shrink-0 text-accentText" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-textPrimary">Classer mes éléments</span>
            <span className="block text-xs text-textDim">
              {totalUnranked} œuvre{totalUnranked > 1 ? 's' : ''} en attente d'un rang.
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-accentText" />
        </button>
      )}
    </div>
  )
}
