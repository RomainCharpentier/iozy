import { ArrowDownWideNarrow, CalendarCheck, Grid2x2, Heart, Layers, LayoutList } from 'lucide-react'
import type { FiltreCollection, TriCollection, VueCollection } from '@/common/lib/preferencesCollection'

const FILTRES: { cle: FiltreCollection; libelle: string }[] = [
  { cle: 'tout', libelle: 'Tout' },
  { cle: 'possedes', libelle: 'Possédés' },
  { cle: 'suivies', libelle: 'Suivies' },
  { cle: 'envies', libelle: 'Envies' },
]

/**
 * The three filters and the two views of My collection.
 *
 * <h2>One page, three readings</h2>
 * "Collection" and "Envies" were two separate screens although they
 * look at the same place (product study of 2026-08-27, section 5). They are
 * FILTERS, and each one reasons about the volumes that a group contains: "Envies"
 * shows the groups that contain at least one wished volume, not the series
 * marked as wished - a series cannot be.
 *
 * <p>The three filters exclude each other, hence a real `radiogroup`: `aria-pressed`
 * would announce three independent switches of which two are "inactive". Same
 * treatment as the volume grid of the detail page, for the same reason.
 *
 * <p>The view is a two-position switch: grouped (one card per
 * GROUP) or ungrouped (the items themselves). The label says what we
 * switch to, never the current state - a button names its action. The sort follows
 * the same rule (batch 148): "Par titre" when sorted by recency, "Récents
 * d'abord" when sorted by title - its label said the state while its
 * accessible name said the action, two voices for one button.
 *
 * <p>On a phone, the four filters take the full width, each its
 * share: placed at their natural width, they went over 390 px and the
 * whole page started to scroll sideways (batch 148).
 *
 * <p>"Grouper" / "Dégrouper", and not "voir les tomes": the volume is the
 * vocabulary of manga, not that of the concept. Each collection type has its
 * own groups - a series for a manga, tomorrow a saga or a range
 * elsewhere - and the label must work for all of them.
 */
export function BarreVues({
  filtre,
  onFiltre,
  vue,
  onVue,
  tri,
  onTri,
  comptes,
}: {
  filtre: FiltreCollection
  onFiltre: (filtre: FiltreCollection) => void
  vue: VueCollection
  onVue: (vue: VueCollection) => void
  tri: TriCollection
  onTri: (tri: TriCollection) => void
  /** What each filter would give - announced before the click, so that an
   *  empty filter is seen instead of being discovered.
   *
   *  `null` while the data has not arrived: showing "0" while
   *  waiting means claiming an empty collection to someone who has one.
   *  A missing number reads as "not known yet", a zero as a fact. */
  comptes: Record<FiltreCollection, number> | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Filtrer ma collection"
        className="flex w-full items-center gap-1 rounded-full bg-softBtn p-1 sm:w-auto"
      >
        {FILTRES.map(({ cle, libelle }) => {
          const actif = cle === filtre
          return (
            <button
              key={cle}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => onFiltre(cle)}
              className={`flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[12px] whitespace-nowrap transition-colors sm:flex-none sm:gap-1.5 sm:px-3.5 sm:text-[13px] ${
                actif ? 'bg-surface font-semibold text-textPrimary shadow-token-sm' : 'text-faint hover:text-textPrimary'
              }`}
            >
              {cle === 'envies' && <Heart size={13} className={actif ? 'fill-current' : undefined} />}
              {cle === 'suivies' && <CalendarCheck size={13} />}
              {libelle}
              {comptes && <span className={actif ? 'text-textDim' : 'text-faint'}>{comptes[cle]}</span>}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => onVue(vue === 'groupee' ? 'plate' : 'groupee')}
        aria-label={vue === 'groupee' ? 'Dégrouper : afficher les éléments un par un' : 'Regrouper les éléments'}
        className="flex min-h-9 items-center gap-2 rounded-full border border-fieldBorder px-3.5 text-[13px] font-medium text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary"
      >
        {vue === 'groupee' ? <Grid2x2 size={14} /> : <Layers size={14} />}
        {vue === 'groupee' ? 'Dégrouper' : 'Grouper'}
      </button>

      <button
        type="button"
        onClick={() => onTri(tri === 'recent' ? 'titre' : 'recent')}
        className="flex min-h-9 items-center gap-2 rounded-full border border-fieldBorder px-3.5 text-[13px] font-medium text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary"
      >
        {tri === 'recent' ? <LayoutList size={14} /> : <ArrowDownWideNarrow size={14} />}
        {tri === 'recent' ? 'Par titre' : 'Récents d\u2019abord'}
      </button>
    </div>
  )
}
