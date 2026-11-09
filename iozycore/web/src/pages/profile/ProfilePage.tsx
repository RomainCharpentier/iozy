import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/common/hooks/useAuth'
import { fetchHomeWeek } from '@/common/api/home'
import { initiales } from '@/common/lib/initiales'
import { queryKeys } from '@/common/lib/queryKeys'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { ProfileValueHero } from './ProfileValueHero'
import { ProfileTierListsSection } from './ProfileTierListsSection'
import { ShareSection } from './ShareSection'
import { Reglages } from './Reglages'

/**
 * The common profile (lot 218): one profile for the collection and for
 * IozyTest.
 *
 * <h2>The person first</h2>
 * The pseudo, very large, beside an avatar in the vivid tone - as on the
 * validated mock-up. Then ONE glass panel: pseudo, color, appearance, title
 * languages, blindtest sound, data (see {@link Reglages}). Every setting
 * applies at once and follows the account.
 *
 * <h2>What stays below, for now</h2>
 * The sharing lives here until its own page (lot 217) takes over; the top
 * bar and IozyTest still land on it ("#partage"). The rankings and the value
 * follow it, as before; a later lot decides where they go.
 *
 * <h2>The backdrop</h2>
 * The cover of the week's lead, the same as the home page: the profile is
 * still the same app, in the same colors.
 */
export function ProfilePage() {
  const { compte } = useAuth()
  const semaine = useQuery({ queryKey: queryKeys.works.home, queryFn: fetchHomeWeek, enabled: !!compte })
  usePleinCadre(semaine.data?.une?.work.coverImageUrl ?? null)

  // Arriving from "Partager" must show the sharing right away: the page is
  // long, and a shortcut that drops at the top shortens nothing. The location
  // key changes on every navigation, so "Partager" clicked again while
  // already here scrolls again. IozyTest links here with "#partage": it
  // cannot pass router state across apps.
  const partageRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const etat = location.state as { focusPartage?: boolean; focusAppareil?: boolean } | null
  const focusPartage = etat?.focusPartage || location.hash === '#partage'
  // "Langue des titres" of the add search: the title row, open.
  const focusTitres = !!etat?.focusAppareil
  useEffect(() => {
    if (focusPartage) partageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusPartage, location.key])

  const pseudo = compte?.pseudo ?? ''

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-5 sm:gap-7 lg:pt-4">
        <span
          aria-hidden="true"
          className="iozy-teinte flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-vive font-display text-3xl font-bold text-encreVive shadow-[0_0_60px_var(--color-vive)] sm:h-28 sm:w-28 sm:text-5xl"
        >
          {initiales(pseudo) || 'IO'}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[clamp(40px,9vw,76px)] leading-[0.95] font-bold tracking-[-0.035em] [overflow-wrap:anywhere] text-textPrimary">
            {pseudo || 'Mon profil'}
          </h1>
          <p className="text-[15px] text-textDim">Un seul profil pour ta collection et pour IozyTest</p>
        </div>
      </header>

      <div className="max-w-[760px]">
        <Reglages ouvrirTitres={focusTitres} />
      </div>

      <div id="partage" ref={partageRef} className="scroll-mt-4 lg:scroll-mt-24">
        <ShareSection />
      </div>
      <ProfileTierListsSection />
      <ProfileValueHero />
    </div>
  )
}
