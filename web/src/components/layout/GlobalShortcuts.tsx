import { Link } from 'react-router-dom'

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
 */
export function GlobalShortcuts({ compact = false }: { compact?: boolean }) {
  const avatarSize = compact ? 'h-9 w-9' : 'h-[38px] w-[38px]'

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/profile"
        title="Mon profil"
        aria-label="Mon profil"
        className={`flex ${avatarSize} shrink-0 items-center justify-center rounded-xl bg-surface font-display text-xs font-semibold text-textDim shadow-token-sm`}
      >
        IO
      </Link>
    </div>
  )
}
