import { Link } from 'react-router-dom'
import { Scale, Sparkles, PartyPopper, Settings2, ChevronRight } from 'lucide-react'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'

interface ProfileLink {
  to: string
  label: string
  description: string
  icon: typeof Scale
}

// Regroupe ce qui n'a pas déjà un point d'entrée global dédié (voir
// DesktopHeader/TabBar : Ma collection/Rechercher/Découvrir + Envies sous le
// cœur + Profil sous l'avatar - "chaque chose appartient à un seul endroit
// clair", commentaire source de la maquette). Ni Wishlist (déjà le cœur) ni
// Suggestions d'achats (déjà dans Découvrir > Opportunités, la maquette ne
// la reliste pas non plus sur Profil) ni Prêts en cours (hors périmètre
// V1.2, §88 - ne pas réintroduire un lien d'entrée depuis une surface
// retravaillée) n'apparaissent plus ici. "Statistiques" n'a pas sa propre
// ligne : le hero Valeur (ProfileValueHero) pointe déjà vers /stats avec de
// vrais chiffres, une 2e ligne identique juste en dessous serait un doublon
// sur le même écran (voir docs/DESIGN_MIGRATION_V1.2.md Lot 8).
const LINKS: ProfileLink[] = [
  { to: '/purchase-analysis', label: 'Évaluer un achat', description: "Analyser une annonce d'occasion avant de l'acheter", icon: Scale },
  { to: '/edition-upgrades', label: 'Envies d\'amélioration', description: 'Séries dont tu recherches une meilleure édition', icon: Sparkles },
  { to: '/recap', label: 'Bilan annuel', description: 'Ton année en un coup d\'œil, façon carte à partager', icon: PartyPopper },
  { to: '/settings', label: 'Paramètres', description: 'Apparence, titres des mangas, administration avancée', icon: Settings2 },
]

export function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Mon profil</h1>

      <ProfileValueHero />
      <ProfileTierListsSection />

      <ul className="flex flex-col gap-2">
        {LINKS.map(({ to, label, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accent">
                <Icon size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-textPrimary">{label}</span>
                <span className="block text-xs text-textDim">{description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-textDim" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
