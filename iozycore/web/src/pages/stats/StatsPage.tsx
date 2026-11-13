import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getStats } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CollectionTimelineSection } from './CollectionTimelineSection'
import { CollectionValueSection } from './CollectionValueSection'
import { AplatChiffre, PageAffiche } from '@/common/components/PageAffiche'
import { LienRetour } from '@/common/components/LienRetour'
import { formaterDecimal } from '@/common/lib/formats'
import { Squelette } from '@/common/components/Squelette'

export function StatsPage() {

  // Always up to date, never cached - stale data makes no sense
  // for statistics (same explicit choice as on the iOS side).
  const statsQuery = useQuery({
    queryKey: queryKeys.insights.stats,
    queryFn: getStats,
    staleTime: 0,
    gcTime: 0,
  })

  // Arriving through "Valeur" (Ma collection) or through the Profil hero must
  // show the value right away: these controls NAME it, and dropping
  // someone at the top of a screen titled "Statistiques" leaves them
  // to look for it. Same pattern as Profil ▸ Partager (see ProfilePage).
  const valeurRef = useRef<HTMLDivElement>(null)
  const focusValeur = (useLocation().state as { focusValeur?: boolean } | null)?.focusValeur
  useEffect(() => {
    if (focusValeur) valeurRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // The section does NOT EXIST before the statistics arrive: without
    // this dependency, the effect looked for a reference that was still empty and
    // left the page at the top - the "Valeur" button then promised a
    // section that one still had to go and look for (observed live).
  }, [focusValeur, statsQuery.data])

  const stats = statsQuery.data
  return (
    <PageAffiche
      affiche={
        <>
          <LienRetour parDefaut={{ to: '/profile', libelle: 'Mon profil' }} />
          {/* The figure of the page (lot 228): the copies held, in the one flat block. */}
          <AplatChiffre
            titre="Statistiques"
            chiffre={stats ? stats.totalActiveOwnerships : '…'}
            legende={stats ? `exemplaire${stats.totalActiveOwnerships > 1 ? 's' : ''} possédé${stats.totalActiveOwnerships > 1 ? 's' : ''}` : 'Chargement…'}
          />
        </>
      }
    >
      <div className="flex flex-col gap-14">
        {statsQuery.isError && <ErrorBanner message={statsQuery.error.message} />}
        {statsQuery.isLoading && <Squelette lignes={3} />}

        {stats && (
          <>
            {/* "Œuvres" and "Exemplaires", never twice "possédés": Ma collection
                counts WORKS, this screen counts COPIES under its own word. The
                copies are the poster; the other three read in big on the backdrop. */}
            <dl className="grid grid-cols-1 border-t border-ligneVerre sm:grid-cols-3">
              {[
                [stats.totalEntities, 'Œuvres au catalogue'],
                [stats.wishlistCount, 'Envies'],
                [stats.experiencesThisYear, 'Expériences cette année'],
              ].map(([valeur, libelle]) => (
                <div key={libelle} className="flex flex-col-reverse gap-1 py-5">
                  <dt className="text-secondaire text-textDim">{libelle}</dt>
                  <dd className="font-display text-[clamp(3.5rem,6vw,5.5rem)] leading-[0.85] font-bold tracking-[-0.06em] text-textPrimary tabular-nums">
                    {valeur}
                  </dd>
                </div>
              ))}
            </dl>

            <CollectionTimelineSection />

            <div id="valeur" ref={valeurRef} className="scroll-mt-24">
              <CollectionValueSection />
            </div>

            {/* Kept like its neighbour "Tags les plus utilisés": without it, the title
                "Par type" was shown alone, with nothing under it. */}
            {stats.byType.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-bloc font-bold tracking-[-0.03em] text-textPrimary">Par type</h2>
                <ul className="grid gap-x-10 gap-y-6 border-t border-ligneVerre pt-5 sm:grid-cols-2 xl:grid-cols-3">
                  {stats.byType.map((type) => (
                    <li key={type.entityTypeCode} className="flex flex-col gap-1">
                      <p className="text-section font-bold text-textPrimary">{type.entityTypeLabel}</p>
                      <p className="flex items-baseline gap-2">
                        <span className="font-display text-outil font-bold tracking-[-0.05em] text-textPrimary tabular-nums">
                          {type.activeOwnershipCount}
                        </span>
                        <span className="text-secondaire text-textDim">
                          exemplaire{type.activeOwnershipCount > 1 ? 's' : ''} possédé{type.activeOwnershipCount > 1 ? 's' : ''}
                        </span>
                      </p>
                      {/* "Fiches" (a series) and "exemplaires" (a volume) are two units, never mixed under one word. */}
                      <p className="text-secondaire text-textDim">
                        {type.entityCount} fiche{type.entityCount > 1 ? 's' : ''} · {type.experienceCount} expérience
                        {type.experienceCount > 1 ? 's' : ''}
                        {type.averageRating !== null && ` · note moyenne ${formaterDecimal(type.averageRating)}/10`}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {stats.topTags.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-bloc font-bold tracking-[-0.03em] text-textPrimary">Tags les plus utilisés</h2>
                {/* Read, not touched: a list on the backdrop, never pills (they would promise a filter). */}
                <ul className="flex flex-wrap gap-x-7 gap-y-2 border-t border-ligneVerre pt-4">
                  {stats.topTags.map((tag) => (
                    <li key={tag.label} className="text-corps flex items-baseline gap-2">
                      <span className="text-textPrimary">{tag.label}</span>
                      <span className="text-faint tabular-nums">{tag.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </PageAffiche>
  )
}
