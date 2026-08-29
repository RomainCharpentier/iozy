import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Settings2, User, Wrench, X } from 'lucide-react'
import { initiales } from '../../lib/initiales'
import { useAuth } from '../../lib/useAuth'
import { useModalA11y } from '../../lib/useModalA11y'

/**
 * Les deux accès de l'en-tête : l'<b>administration</b>, et le compte.
 *
 * <h2>Deux boutons, et c'est le sujet</h2>
 * L'administration a son <b>propre bouton</b>, à côté de l'avatar et pas
 * dedans. Elle a mis trois essais à trouver sa place : d'abord sous
 * Paramètres, puis en lien sur Profil, puis dans le menu de l'avatar - trois
 * fois rangée derrière quelque chose qui appartient à l'utilisateur. Or
 * déclarer les catégories de sa collection ou renseigner une édition de
 * référence n'est pas un réglage personnel : c'est l'outillage de
 * l'application. Il ne se trouve pas en cherchant son profil.
 *
 * <p>L'avatar, lui, garde ce qui est vraiment personnel : son profil et ses
 * réglages. Deux entrées, un menu qui tient en deux lignes.
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

interface EntreeDuMenu {
  to: string
  label: string
  description: string
  icon: typeof User
}

/** Ce qui est PERSONNEL, et rien d'autre : l'administration a son bouton. */
const ENTREES: EntreeDuMenu[] = [
  { to: '/profile', label: 'Mon profil', description: 'Valeur, classements, partage', icon: User },
  { to: '/settings', label: 'Paramètres', description: 'Ton compte, emporter ta collection, apparence', icon: Settings2 },
]

export function GlobalShortcuts({ compact = false }: { compact?: boolean }) {
  const { compte } = useAuth()
  const [ouvert, setOuvert] = useState(false)
  // Échap + piège de focus + focus rendu au déclencheur - voir useModalA11y
  // (Lot 9, partagé par tous les panneaux de l'application).
  const menuRef = useModalA11y<HTMLDivElement>(ouvert, () => setOuvert(false))
  const { pathname } = useLocation()

  const taille = compact ? 'h-9 w-9' : 'h-[38px] w-[38px]'
  const marque = initiales(compte?.pseudo ?? '') || 'IO'
  // Le pseudo est DIT, pas seulement dessiné : « RO » lu à voix haute par un
  // lecteur d'écran n'apprend rien à personne.
  const intitule = compte ? `Mon compte — ${compte.pseudo}` : 'Mon compte'
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

      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        title={intitule}
        aria-label={intitule}
        className={`flex ${taille} shrink-0 items-center justify-center rounded-xl bg-surface font-display text-xs font-semibold text-textDim shadow-token-sm hover:text-textPrimary`}
      >
        {marque}
      </button>

      {ouvert && (
        <>
          {/* Feuille au pouce, popover ancré à droite au-dessus de 768 px -
              même patron que « Outils de ma collection » (voir ShelfPage). */}
          <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={() => setOuvert(false)} />
          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-compte-titre"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-token-elevated md:inset-x-auto md:top-16 md:right-[max(12px,calc((100%-min(100%-48px,1600px))/2))] md:bottom-auto md:w-[300px] md:rounded-2xl md:border md:border-surface2"
          >
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <span id="menu-compte-titre" className="min-w-0 truncate font-display text-sm font-semibold text-textPrimary">
                {compte?.pseudo ?? 'Mon compte'}
              </span>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
              >
                <X size={16} />
              </button>
            </div>

            {ENTREES.map(({ to, label, description, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOuvert(false)}
                // L'écran courant est ANNONCÉ, pas seulement peint : un menu
                // qui ne dit pas où l'on est déjà fait cliquer pour rien.
                aria-current={pathname === to ? 'page' : undefined}
                className="flex min-h-[50px] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-rowHover"
              >
                <Icon size={17} className="shrink-0 text-textDim" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-textPrimary">{label}</span>
                  <span className="text-xs text-textDim">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
