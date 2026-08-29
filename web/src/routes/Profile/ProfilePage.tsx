import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'
import { ShareSection } from '../Share/ShareSection'
import { useEffect, useRef } from 'react'
import { EnTeteSection } from '../../components/EnTeteSection'

// Plus aucune liste de liens ici.
//
// Cet écran a servi de couloir : on y passait pour atteindre les réglages,
// puis l'administration - trois niveaux pour déclarer une catégorie de
// collection, et une administration rangée sous les réglages de
// l'utilisateur, ce qui n'a aucun sens. Les trois écrans sont désormais
// SŒURS, dans le menu de l'avatar (voir GlobalShortcuts) : à égale
// distance, depuis partout.
//
// Ce qui reste ici est ce qui parle de CETTE collection : sa valeur, ses
// classements, son partage.

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
    </div>
  )
}
