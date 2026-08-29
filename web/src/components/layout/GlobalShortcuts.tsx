import { Link, useLocation } from 'react-router-dom'
import { Wrench } from 'lucide-react'
import { initiales } from '../../lib/initiales'
import { useAuth } from '../../lib/useAuth'

/**
 * Les deux accès de l'en-tête : l'<b>administration</b>, et le profil.
 *
 * <h2>Deux boutons, et c'est le sujet</h2>
 * L'administration a son <b>propre bouton</b>, à côté de l'avatar et pas
 * dedans. Elle a mis trois essais à trouver sa place : sous Paramètres, puis
 * en lien sur Profil, puis dans un menu déroulant de l'avatar - trois fois
 * rangée derrière quelque chose qui appartient à l'utilisateur. Or déclarer
 * les catégories de sa collection ou renseigner une édition de référence n'est
 * pas un réglage personnel : c'est l'outillage de l'application, et il ne se
 * trouve pas en cherchant son profil.
 *
 * <p>Ce qu'elle ne contient pas, en revanche : l'import BGG, qui AJOUTE à la
 * collection et vit donc dans Rechercher, à côté de Scanner.
 *
 * <h2>Deux liens, et aucun menu</h2>
 * L'avatar mène droit à Profil - un clic, pas un panneau à ouvrir puis à
 * refermer pour un choix entre deux entrées. Les réglages se rejoignent depuis
 * Profil, où ils sont chez eux : les deux écrans parlent de la même personne.
 *
 * <h2>Ce que ces boutons ne sont pas</h2>
 * Des destinations de navigation. Les quatre intentions quotidiennes vivent
 * dans {@code NAV_ITEMS} et nulle part ailleurs ; ceci est ce qui n'appartient
 * à aucune d'elles.
 *
 * <h2>Le cœur « Envies » a été retiré (2026-08-28)</h2>
 * Il ne menait plus à un écran à lui depuis le Lot 38 : les envies sont une
 * LECTURE de Ma collection, et le cœur se contentait de poser le filtre avant
 * d'y naviguer. Or cette page porte déjà « Tout / Possédés / Envies » dans sa
 * barre de vues : le raccourci doublait un bouton visible, en permanence, sur
 * tous les écrans. Le décompte n'est pas perdu : la barre de vues affiche
 * « Envies · N » là où le nombre se lit avec ce qu'il compte.
 *
 * <h2>Les initiales du pseudo (2026-08-29)</h2>
 * L'avatar affichait « IO » en dur - les initiales de l'application, sur le
 * bouton qui mène au compte de quelqu'un. Le repli reste « IO », et il est
 * atteignable : ce composant vit dans l'{@code AppShell}, qui ne se rend que
 * connecté, mais le compte arrive par une requête - il y a donc un instant, au
 * premier chargement, où il n'est pas encore là.
 */
export function GlobalShortcuts({ compact = false }: { compact?: boolean }) {
  const { compte } = useAuth()
  const { pathname } = useLocation()

  const taille = compact ? 'h-9 w-9' : 'h-[38px] w-[38px]'
  const marque = initiales(compte?.pseudo ?? '') || 'IO'
  // Le pseudo est DIT, pas seulement dessiné : « RO » lu à voix haute par un
  // lecteur d'écran n'apprend rien à personne.
  const intitule = compte ? `Mon profil — ${compte.pseudo}` : 'Mon profil'
  const surAdministration = pathname.startsWith('/administration')

  return (
    <div className="flex items-center gap-2">
      {/* L'outillage de l'application, sur son propre bouton. Une icône seule :
          l'en-tête doit rester calme, et « Administration » à côté d'un avatar
          ferait deux libellés pour deux choses qu'on ouvre rarement. Le nom est
          porté par `aria-label` ET `title` - le title seul est le dernier
          recours de l'algorithme de nom accessible, et n'existe pas au doigt
          (voir Lot 29). */}
      <Link
        to="/administration"
        title="Administration"
        aria-label="Administration"
        aria-current={surAdministration ? 'page' : undefined}
        className={`flex ${taille} shrink-0 items-center justify-center rounded-xl transition-colors ${
          surAdministration
            ? 'bg-surface text-textPrimary shadow-token-sm'
            : 'text-textDim hover:bg-rowHover hover:text-textPrimary'
        }`}
      >
        <Wrench size={17} />
      </Link>

      <Link
        to="/profile"
        title={intitule}
        aria-label={intitule}
        aria-current={pathname === '/profile' ? 'page' : undefined}
        className={`flex ${taille} shrink-0 items-center justify-center rounded-xl bg-surface font-display text-xs font-semibold shadow-token-sm transition-colors ${
          pathname === '/profile' ? 'text-textPrimary' : 'text-textDim hover:text-textPrimary'
        }`}
      >
        {marque}
      </Link>
    </div>
  )
}
