import { Link, useLocation } from 'react-router-dom'
import { Settings2, ChevronRight } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'
import { ShareSection } from '../Share/ShareSection'
import { useEffect, useRef } from 'react'
import { EnTeteSection } from '../../components/EnTeteSection'

interface ProfileLink {
  to: string
  label: string
  description: string
  icon: typeof Settings2
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
// Deux lignes ont quitté cette liste le 2026-08-29, et pour deux raisons
// différentes. « Analyser une annonce » est l'une des QUATRE destinations de la
// barre de navigation (voir navItems) : le lien d'ici était un doublon exact,
// sur un écran qui n'est pas une liste de raccourcis. « Bilan annuel » est une
// LECTURE de la collection, pas un réglage : il a rejoint Découvrir, avec les
// autres lectures.
//
// Ce qui reste est le seul chemin qui n'existe nulle part ailleurs.
const LINKS: ProfileLink[] = [
  {
    to: '/settings',
    label: 'Paramètres',
    description: 'Ton compte, emporter ta collection, apparence',
    icon: Settings2,
  },
]

export function ProfilePage() {
  const { compte } = useAuth()
  // Arriver depuis « Ma collection ▸ Partager » doit montrer le partage tout
  // de suite : la page Profil est longue, et un raccourci qui dépose en haut
  // sans rien désigner ne raccourcit rien.
  const partageRef = useRef<HTMLDivElement>(null)
  const focusPartage = (useLocation().state as { focusPartage?: boolean } | null)?.focusPartage
  useEffect(() => {
    if (focusPartage) partageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusPartage])

  return (
    <div className="flex flex-col gap-5">
      {/* Le pseudo en sous-titre, pas une section : la section Compte a
          rejoint Paramètres, où vivent aussi la déconnexion et l'export - un
          seul endroit pour « mon compte » au lieu de deux moitiés. Mais un
          écran qui s'appelle « Mon profil » doit quand même dire DE QUI. */}
      <EnTeteSection niveau={1} titre="Mon profil" sousTitre={compte?.pseudo} />

      <ProfileValueHero />
      <ProfileTierListsSection />
      {/* "Partager ma collection" - emplacement de la maquette V1.2 (Profil),
          au-dessus des lignes d'accès aux autres écrans : c'est un réglage de
          CE profil, pas une destination de plus. */}
      {/* Le partage vit ici, sa maison principale. Les raccourcis de « Ma
          collection » et de « Mes envies » mènent au même partage et au même
          jeton - c'est bien ce composant qu'ils pilotent, jamais un second. */}
      <div id="partage" ref={partageRef} className="scroll-mt-4">
        <ShareSection />
      </div>

      <ul className="flex flex-col gap-2">
        {LINKS.map(({ to, label, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
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
