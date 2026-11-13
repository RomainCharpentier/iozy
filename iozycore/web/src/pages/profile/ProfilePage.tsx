import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/common/hooks/useAuth'
import { fetchHomeWeek } from '@/common/api/home'
import { initiales } from '@/common/lib/initiales'
import { queryKeys } from '@/common/lib/queryKeys'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { ChevronRight } from 'lucide-react'
import { Reglages } from './Reglages'

/**
 * The common profile (lot 218): one profile for the collection and for
 * IozyTest.
 *
 * <h2>The person first</h2>
 * The pseudo at 48 px beside a round badge in the vivid tone, then the
 * settings as rows on the backdrop: pseudo, color, appearance, title
 * languages, blindtest sound, data (see {@link Reglages}). Every setting
 * applies at once and follows the account.
 *
 * <h2>Then where to go next (lot 229)</h2>
 * The share settings, the rankings and the value were three cards here.
 * Sharing has its own page since lot 217, the value lives on Statistiques:
 * one row each now leads there, in the tool template.
 *
 * <h2>The backdrop</h2>
 * The cover of the week's lead, the same as the home page: the profile is
 * still the same app, in the same colors.
 */
export function ProfilePage() {
  const { compte } = useAuth()
  const semaine = useQuery({ queryKey: queryKeys.works.home, queryFn: fetchHomeWeek, enabled: !!compte })
  usePleinCadre(semaine.data?.une?.work.coverImageUrl ?? null)

  const location = useLocation()
  // "Langue des titres" of the add search: the title row, open.
  const focusTitres = !!(location.state as { focusAppareil?: boolean } | null)?.focusAppareil

  const pseudo = compte?.pseudo ?? ''

  return (
    <div className="flex flex-col gap-10">
      {/* Lot 229, the tool template: a 760 px column, the title at 48 px, rows on the
          backdrop. A profile has no figure, so no flat block: the initials are a
          round badge, as everything that stands for a person. */}
      <header className="flex items-center gap-5 lg:pt-4">
        <span
          aria-hidden="true"
          className="iozy-teinte flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-vive font-display text-bloc font-bold text-encreVive"
        >
          {initiales(pseudo) || 'IO'}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-outil font-bold tracking-[-0.045em] [overflow-wrap:anywhere] text-textPrimary">
            {pseudo || 'Mon profil'}
          </h1>
          <p className="text-secondaire text-textDim">Un seul profil pour ta collection et pour IozyTest</p>
        </div>
      </header>

      <Reglages ouvrirTitres={focusTitres} />

      {/* What used to be three cards (the share settings, the rankings, the value)
          lives on its own screen: here, one row each leads there. Sharing is set on
          Partager since lot 217. */}
      <nav aria-label="Aller plus loin" className="flex flex-col border-t border-ligneVerre">
        {[
          { to: '/stats', titre: 'Statistiques', detail: 'Ce que compte ta collection, sa valeur' },
          { to: '/tier-lists', titre: 'Tier Lists', detail: 'Tes classements' },
          { to: '/share', titre: 'Partager', detail: 'Ta page publique, ta liste de cadeaux' },
        ].map((acces) => (
          <Link
            key={acces.to}
            to={acces.to}
            className="flex min-h-14 items-center justify-between gap-4 border-b border-ligneVerre py-3 text-textPrimary transition-colors hover:text-vive"
          >
            <span className="text-section font-bold">{acces.titre}</span>
            <span className="text-secondaire flex items-center gap-1 text-textDim">
              {acces.detail}
              <ChevronRight size={16} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
