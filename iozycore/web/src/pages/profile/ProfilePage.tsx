import { useLocation } from 'react-router-dom'
import { useAuth } from '@/common/hooks/useAuth'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'
import { ShareSection } from './ShareSection'
import { Reglages } from './Reglages'
import { useEffect, useRef } from 'react'
import { EnTeteSection } from '@/common/components/EnTeteSection'

// Everything that speaks of this person, readable at a glance.
//
// This screen used to be a corridor: one went through it to reach the settings,
// THEN the administration - three levels to declare a collection
// category, and an administration stored behind the settings of the
// user, which makes no sense. The administration now has its own
// button in the header (see GlobalShortcuts); the settings, for their part,
// are HERE, in the open, and no longer behind a "Paramètres" link (batch 140,
// user request: "pas de sous-menu, ça doit être lisible
// direct"). A screen that speaks of the same person does not have to open a
// second one to finish its sentence.
//
// What left this list: "Analyser une annonce" (a destination of
// the bar, then a gate of Découvrir), "Bilan annuel" (a reading of the
// collection, gone to join Découvrir), and "Demander à ma collection"
// (batch 117, removed in batch 140: "ne sert à rien").

export function ProfilePage() {
  const { compte } = useAuth()
  // Arriving from "Ma collection ▸ Partager" must show the sharing right
  // away, and from "Langue des titres" of the Catalog the settings of
  // the device: the page is long, and a shortcut that drops at the top without
  // pointing at anything shortens nothing.
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
      {/* The username as subtitle: a screen called "Mon profil"
          must say WHOSE. The address, the export and the language of the titles are
          further down, in the settings - on this page, not on another one. */}
      <EnTeteSection niveau={1} titre="Mon profil" sousTitre={compte?.pseudo} />

      <ProfileValueHero />
      <ProfileTierListsSection />
      {/* The sharing lives here, its main home. The shortcuts of "Ma
          collection" and "Mes envies" lead to the same sharing and the same
          token - it is this component that they drive, never a second one. */}
      <div id="partage" ref={partageRef} className="scroll-mt-4">
        <ShareSection />
      </div>

      <Reglages appareilRef={appareilRef} />
    </div>
  )
}
