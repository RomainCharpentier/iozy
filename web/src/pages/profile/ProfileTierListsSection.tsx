import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { flatRankedCovers } from '@/common/lib/tierListVisuals'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { useDonneesTierLists } from '@/common/hooks/useDonneesTierLists'

/**
 * "Mes Tier Lists" on Profil (see DS v1.1 section 44 Profil screen): one row
 * per universe that is really ranked (covers of the ranked works + counter)
 * + one row per custom Tier List (item counter, without cover -
 * same reduction already applied on TierListsScreen: avoid a detail
 * request per list just for 3 thumbnails). "Tout voir" -> `/tier-lists`.
 * Absent entirely if nothing is ranked anywhere AND no custom Tier List
 * exists - never an empty card.
 */
export function ProfileTierListsSection() {
  const donnees = useDonneesTierLists()

  if (!donnees.typesCharges || donnees.chargement) return null

  const universeRows = donnees.univers
    .map((u) => ({ entityType: u.entityType, counts: u.counts, covers: flatRankedCovers(u.board, 3) }))
    .filter((u) => u.counts.ranked > 0)

  // The "toutes catégories" lists included: this card forgot them,
  // while it announces "Mes Tier Lists" and offers "Tout voir".
  const customLists = donnees.toutesLesListes

  if (universeRows.length === 0 && customLists.length === 0) return null

  return (
    <div className={`mt-3 ${CLASSE_CARTE}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-textPrimary">Mes Tier Lists</h2>
        <Link to="/tier-lists" className="min-h-11 text-xs font-semibold text-accentText">
          Tout voir
        </Link>
      </div>
      <div className="mt-2.5 flex flex-col gap-0.5">
        {universeRows.map(({ entityType, counts, covers }) => (
          <Link
            key={entityType.id}
            to={`/tier-lists/general/${entityType.id}`}
            state={{ retour: { to: '/profile', libelle: 'Mon profil' } }}
            className="flex min-h-12 items-center gap-3 rounded-xl px-1.5 transition-colors hover:bg-rowHover"
          >
            <span className="flex shrink-0 gap-0.5">
              {covers.map((cover, i) => (
                <Jaquette
                  key={i}
                  src={cover}
                  className="h-6 w-4 rounded-[3px] object-cover"
                  repli={<span className="h-6 w-4 rounded-[3px] bg-surface2" />}
                />
              ))}
            </span>
            <TexteCoupe texte={entityType.label} className="min-w-0 flex-1 truncate text-sm text-textPrimary" />
            <span className="shrink-0 text-xs font-semibold text-textDim">
              {counts.ranked} classé{counts.ranked > 1 ? 's' : ''}
            </span>
            <ChevronRight size={15} className="shrink-0 text-textDim" />
          </Link>
        ))}
        {customLists.map((list) => (
          <Link
            key={list.id}
            to={`/tier-lists/${list.id}`}
            state={{ retour: { to: '/profile', libelle: 'Mon profil' } }}
            className="flex min-h-12 items-center gap-3 rounded-xl px-1.5 transition-colors hover:bg-rowHover"
          >
            <TexteCoupe texte={list.name} className="min-w-0 flex-1 truncate text-sm text-textPrimary" />
            <span className="shrink-0 text-xs font-semibold text-textDim">
              {list.itemCount} élément{list.itemCount > 1 ? 's' : ''}
            </span>
            <ChevronRight size={15} className="shrink-0 text-textDim" />
          </Link>
        ))}
      </div>
    </div>
  )
}
