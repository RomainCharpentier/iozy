import { ArrowDownWideNarrow, Grid2x2, Heart, Layers, LayoutList } from 'lucide-react'
import type { FiltreCollection, TriCollection, VueCollection } from '../../lib/preferencesCollection'

const FILTRES: { cle: FiltreCollection; libelle: string }[] = [
  { cle: 'tout', libelle: 'Tout' },
  { cle: 'possedes', libelle: 'Possédés' },
  { cle: 'envies', libelle: 'Envies' },
]

/**
 * Les trois filtres et les deux vues de Ma collection.
 *
 * <h2>Une page, trois lectures</h2>
 * « Collection » et « Envies » étaient deux écrans séparés alors qu'ils
 * regardent le même endroit (étude produit du 2026-08-27, §5). Ce sont des
 * FILTRES, et chacun raisonne sur les tomes qu'un groupe contient : « Envies »
 * montre les groupes contenant au moins un tome voulu, pas les séries
 * marquées voulues - une série ne peut pas l'être.
 *
 * <p>Les trois filtres s'excluent, d'où un vrai `radiogroup` : `aria-pressed`
 * annoncerait trois interrupteurs indépendants dont deux « inactifs ». Même
 * traitement que la grille de tomes de la fiche, pour la même raison.
 *
 * <p>La vue est un interrupteur à deux positions : groupée (une carte par
 * GROUPE) ou dégroupée (les éléments eux-mêmes). Le libellé dit ce vers quoi
 * on bascule, jamais l'état courant - un bouton nomme son action.
 *
 * <p>« Grouper » / « Dégrouper », et non « voir les tomes » : le tome est le
 * vocabulaire du manga, pas celui du concept. Chaque type de collection a ses
 * propres groupes - une série pour un manga, demain une saga ou une gamme
 * ailleurs - et le libellé doit valoir pour tous.
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
  /** Ce que chaque filtre donnerait - annoncé avant le clic, pour qu'un
   *  filtre vide se voie au lieu de se découvrir.
   *
   *  `null` tant que les données ne sont pas arrivées : afficher « 0 » en
   *  attendant, c'est affirmer une collection vide à quelqu'un qui en a une.
   *  Un chiffre absent se lit comme « pas encore su », un zéro comme un fait. */
  comptes: Record<FiltreCollection, number> | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Filtrer ma collection"
        className="flex items-center gap-1 rounded-full bg-softBtn p-1"
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
              className={`flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors ${
                actif ? 'bg-surface font-semibold text-textPrimary shadow-token-sm' : 'text-faint hover:text-textPrimary'
              }`}
            >
              {cle === 'envies' && <Heart size={13} className={actif ? 'fill-current' : undefined} />}
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
        aria-label={tri === 'recent' ? 'Trier par titre' : 'Trier par arrivée récente'}
        className="flex min-h-9 items-center gap-2 rounded-full border border-fieldBorder px-3.5 text-[13px] font-medium text-textDim transition-colors hover:bg-rowHover hover:text-textPrimary"
      >
        {tri === 'recent' ? <ArrowDownWideNarrow size={14} /> : <LayoutList size={14} />}
        {tri === 'recent' ? 'Récents d\u2019abord' : 'Par titre'}
      </button>
    </div>
  )
}
