import { Link, useLocation } from 'react-router-dom'
import { Scale, PartyPopper, Settings2, ChevronRight, LogOut } from 'lucide-react'
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
  { to: '/purchase-analysis', label: 'Analyser une annonce', description: "Estimer une annonce d'occasion avant de l'acheter", icon: Scale },
  { to: '/recap', label: 'Bilan annuel', description: 'Ton année en un coup d\'œil, façon carte à partager', icon: PartyPopper },
  { to: '/settings', label: 'Paramètres', description: 'Apparence, titres des mangas, administration avancée', icon: Settings2 },
]

export function ProfilePage() {
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
      <EnTeteSection niveau={1} titre="Mon profil" />

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

      <SectionCompte />
    </div>
  )
}

/**
 * Qui est connecté, et comment sortir.
 *
 * <p>Sur Profil et nulle part ailleurs : se déconnecter est un geste rare, et
 * un bouton posé dans un en-tête permanent se cliquerait par erreur bien plus
 * souvent qu'à dessein. L'adresse est affichée parce que c'est la seule chose
 * qui distingue deux comptes sur une même instance - sans elle, on ne sait pas
 * de quelle collection on regarde les chiffres.
 */
function SectionCompte() {
  const { compte, deconnexion } = useAuth()
  if (!compte) return null
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs tracking-wide text-textDim uppercase">Compte</span>
        <span className="font-medium text-textPrimary">{compte.pseudo}</span>
        {/* Toujours affichée, désormais : un pseudo ne peut plus être l'adresse
            (voir AppUser), donc les deux lignes ne se répètent jamais. */}
        <span className="text-xs text-textDim">{compte.email}</span>
      </div>
      <button
        type="button"
        onClick={() => deconnexion.mutate()}
        disabled={deconnexion.isPending}
        className="flex items-center justify-center gap-2 self-start rounded-lg bg-surface2 px-4 py-2 text-sm font-medium text-textPrimary disabled:opacity-50"
      >
        <LogOut size={16} />
        Se déconnecter
      </button>
    </section>
  )
}
