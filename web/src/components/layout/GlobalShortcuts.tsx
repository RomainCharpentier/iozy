import { Link } from 'react-router-dom'
import { initiales } from '../../lib/initiales'
import { useAuth } from '../../lib/useAuth'

/**
 * L'accès global qui n'est PAS une destination de navigation : le Profil
 * (avatar). Voir la maquette V1.2 - « Trois intentions, trois espaces. Tout le
 * reste vit dans l'espace auquel il appartient ».
 *
 * <h2>Le cœur « Envies » a été retiré (2026-08-28)</h2>
 * Il ne menait plus à un écran à lui depuis le Lot 38 : les envies sont une
 * LECTURE de Ma collection, et le cœur se contentait de poser le filtre avant
 * d'y naviguer. Or cette page porte déjà « Tout / Possédés / Envies » dans sa
 * barre de vues : le raccourci doublait un bouton visible, en permanence, sur
 * tous les écrans.
 *
 * <p>Sa raison d'être historique a disparu avec `/wishlist` : ce composant
 * existe parce qu'au 2026-08-21 le cœur et l'avatar ne vivaient que sur
 * desktop, rendant les envies et le profil inatteignables en dessous de 768 px
 * (UX-1, voir docs/USER_JOURNEYS.md). Le profil reste dans ce cas - c'est bien
 * une destination sans autre chemin. Les envies, non : Ma collection est dans
 * la barre du pouce, et le filtre est sur la page.
 *
 * <p>Le décompte n'est pas perdu : la barre de vues affiche « Envies · N » là
 * où le nombre se lit avec ce qu'il compte.
 *
 * <h2>L'avatar porte les initiales du PSEUDO (2026-08-29)</h2>
 * Il affichait « IO » en dur - les initiales de l'application, sur un bouton
 * qui mène au compte de quelqu'un. Sur une instance à plusieurs personnes,
 * c'était le seul endroit de l'écran qui aurait pu dire au nom de qui on
 * travaille, et il disait le nom du logiciel.
 *
 * <p>Le repli reste « IO », et il est atteignable : ce composant vit dans
 * l'{@code AppShell}, qui ne se rend que connecté, mais le compte arrive par
 * une requête - il y a donc un instant, au premier chargement, où il n'est pas
 * encore là. Deux lettres qui changent valent mieux qu'un trou qui se remplit.
 */
export function GlobalShortcuts({ compact = false }: { compact?: boolean }) {
  const { compte } = useAuth()
  const avatarSize = compact ? 'h-9 w-9' : 'h-[38px] w-[38px]'
  const marque = initiales(compte?.pseudo ?? '') || 'IO'
  // Le pseudo est DIT, pas seulement dessiné : « MC » lu à voix haute par un
  // lecteur d'écran n'apprend rien à personne.
  const intitule = compte ? `Mon profil — ${compte.pseudo}` : 'Mon profil'

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/profile"
        title={intitule}
        aria-label={intitule}
        className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-xl bg-surface font-display text-xs font-semibold text-textDim shadow-token-sm`}
      >
        {marque}
      </Link>
    </div>
  )
}
