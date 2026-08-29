import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { flatRankedCovers } from '../../lib/tierListVisuals'
import { TexteCoupe } from '../../components/TexteCoupe'
import { Jaquette } from '../../components/Jaquette'
import { CLASSE_CARTE } from '../../components/Carte'
import { useDonneesTierLists } from '../../lib/useDonneesTierLists'

/**
 * "Mes Tier Lists" sur Profil (voir DS v1.1 §44 écran Profil) : une rangée
 * par univers réellement classé (jaquettes des œuvres classées + compteur)
 * + une rangée par Tier List perso (compteur d'éléments, sans jaquette -
 * même réduction déjà appliquée sur TierListsScreen : éviter une requête de
 * détail par liste juste pour 3 miniatures). "Tout voir" -> `/tier-lists`.
 * Absente entièrement si rien n'est classé nulle part ET aucune Tier List
 * perso n'existe - jamais une carte vide.
 */
export function ProfileTierListsSection() {
  const donnees = useDonneesTierLists()

  if (!donnees.typesCharges || donnees.chargement) return null

  const universeRows = donnees.univers
    .map((u) => ({ entityType: u.entityType, counts: u.counts, covers: flatRankedCovers(u.board, 3) }))
    .filter((u) => u.counts.ranked > 0)

  // Les listes « toutes catégories » comprises : cette carte les oubliait,
  // alors qu'elle annonce « Mes Tier Lists » et propose « Tout voir ».
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
