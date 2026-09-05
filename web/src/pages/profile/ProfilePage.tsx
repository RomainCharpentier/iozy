import { useLocation } from 'react-router-dom'
import { useAuth } from '@/common/hooks/useAuth'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'
import { ShareSection } from './ShareSection'
import { Reglages } from './Reglages'
import { useEffect, useRef } from 'react'
import { EnTeteSection } from '@/common/components/EnTeteSection'

// Tout ce qui parle de cette personne, lisible d'un coup.
//
// Cet écran a servi de couloir : on y passait pour atteindre les réglages,
// PUIS l'administration - trois niveaux pour déclarer une catégorie de
// collection, et une administration rangée derrière les réglages de
// l'utilisateur, ce qui n'a aucun sens. L'administration a désormais son
// propre bouton dans l'en-tête (voir GlobalShortcuts) ; les réglages, eux,
// sont ICI, en clair, et plus derrière un lien « Paramètres » (lot 140,
// demande de l'utilisateur : « pas de sous-menu, ça doit être lisible
// direct »). Un écran qui parle de la même personne n'a pas à en ouvrir un
// second pour finir sa phrase.
//
// Ce qui a quitté cette liste : « Analyser une annonce » (une destination de
// la barre, puis une porte de Découvrir), « Bilan annuel » (une lecture de la
// collection, partie rejoindre Découvrir), et « Demander à ma collection »
// (lot 117, retirée au lot 140 : « ne sert à rien »).

export function ProfilePage() {
  const { compte } = useAuth()
  // Arriver depuis « Ma collection ▸ Partager » doit montrer le partage tout
  // de suite, et depuis « Langue des titres » du Catalogue les réglages de
  // l'appareil : la page est longue, et un raccourci qui dépose en haut sans
  // rien désigner ne raccourcit rien.
  const partageRef = useRef<HTMLDivElement>(null)
  const appareilRef = useRef<HTMLDivElement>(null)
  const etat = useLocation().state as { focusPartage?: boolean; focusAppareil?: boolean } | null
  const focusPartage = etat?.focusPartage
  const focusAppareil = etat?.focusAppareil
  useEffect(() => {
    if (focusPartage) partageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (focusAppareil) appareilRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusPartage, focusAppareil])

  return (
    <div className="flex flex-col gap-5">
      {/* Le pseudo en sous-titre : un écran qui s'appelle « Mon profil »
          doit dire DE QUI. L'adresse, l'export et la langue des titres sont
          plus bas, dans les réglages - sur cette page, pas sur une autre. */}
      <EnTeteSection niveau={1} titre="Mon profil" sousTitre={compte?.pseudo} />

      <ProfileValueHero />
      <ProfileTierListsSection />
      {/* Le partage vit ici, sa maison principale. Les raccourcis de « Ma
          collection » et de « Mes envies » mènent au même partage et au même
          jeton - c'est bien ce composant qu'ils pilotent, jamais un second. */}
      <div id="partage" ref={partageRef} className="scroll-mt-4">
        <ShareSection />
      </div>

      <Reglages appareilRef={appareilRef} />
    </div>
  )
}
