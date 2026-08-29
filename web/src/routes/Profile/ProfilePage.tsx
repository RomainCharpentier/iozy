import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Settings2 } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'
import { ShareSection } from '../Share/ShareSection'
import { useEffect, useRef } from 'react'
import { EnTeteSection } from '../../components/EnTeteSection'

// Une seule sortie, et elle parle de la même personne que cet écran.
//
// Cet écran a servi de couloir : on y passait pour atteindre les réglages,
// PUIS l'administration - trois niveaux pour déclarer une catégorie de
// collection, et une administration rangée derrière les réglages de
// l'utilisateur, ce qui n'a aucun sens. L'administration a désormais son
// propre bouton dans l'en-tête (voir GlobalShortcuts) ; les réglages, eux,
// restent ici, où ils sont chez eux.
//
// Ce qui a quitté cette liste : « Analyser une annonce » (l'une des quatre
// destinations de la barre de navigation, donc un doublon exact) et « Bilan
// annuel » (une lecture de la collection, partie rejoindre Découvrir).

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
      {/* Le partage vit ici, sa maison principale. Les raccourcis de « Ma
          collection » et de « Mes envies » mènent au même partage et au même
          jeton - c'est bien ce composant qu'ils pilotent, jamais un second. */}
      <div id="partage" ref={partageRef} className="scroll-mt-4">
        <ShareSection />
      </div>

      <Link
        to="/settings"
        className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
          <Settings2 size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-medium text-textPrimary">Paramètres</span>
          <span className="block text-xs text-textDim">Ton compte, emporter ta collection, apparence</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-textDim" />
      </Link>
    </div>
  )
}
