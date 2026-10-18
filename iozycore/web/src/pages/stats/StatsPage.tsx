import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getStats } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { StatCard } from './StatCard'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CollectionTimelineSection } from './CollectionTimelineSection'
import { CollectionValueSection } from './CollectionValueSection'
import { EnTeteSection } from '@/common/components/EnTeteSection'
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

  return (
    <div className="flex flex-col gap-6">
      <LienRetour parDefaut={{ to: '/profile', libelle: 'Mon profil' }} />

      <EnTeteSection niveau={1} titre="Statistiques" />

      {statsQuery.isError && <ErrorBanner message={statsQuery.error.message} />}
      {statsQuery.isLoading && <Squelette lignes={3} />}

      {statsQuery.data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {/* "Œuvres" and "Exemplaires", never twice "possédés".
                Ma collection counts WORKS ("5 titres possédés"), this
                screen counted COPIES under the same word: both
                numbers were right and contradicted each other when read
                (5 against 10). "Entités" only said the name of the table. */}
            <StatCard value={String(statsQuery.data.totalEntities)} label="Œuvres au catalogue" />
            <StatCard value={String(statsQuery.data.totalActiveOwnerships)} label="Exemplaires possédés" />
            <StatCard value={String(statsQuery.data.wishlistCount)} label="Envies" />
            <StatCard value={String(statsQuery.data.experiencesThisYear)} label="Expériences cette année" />
          </div>

          <div id="valeur" ref={valeurRef} className="scroll-mt-4">
            <CollectionValueSection />
          </div>

          <CollectionTimelineSection />

          {/* Kept like its neighbour "Tags les plus utilisés" just below:
              without it, the title "Par type" was shown alone, with nothing under
              it. An orphan subheading reads as a loading that never
              completed. */}
          {statsQuery.data.byType.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-textPrimary">Par type</h2>
            <ul className="flex flex-col gap-2">
              {statsQuery.data.byType.map((type) => (
                <li key={type.entityTypeCode} className="rounded-xl bg-surface p-3">
                  <p className="font-medium text-textPrimary">{type.entityTypeLabel}</p>
                  {/* "Fiches" (Entity, e.g. a series) and "exemplaires possédés" (Ownership,
                      e.g. a volume) are two different units - never mixed under
                      generic labels ("au total"/"possédé(s)") that did not specify it,
                      to the point of reading as contradictory (more "possédé" than
                      "total" is the normal case for a multi-volume manga). */}
                  <p className="text-sm text-textDim">
                    {type.entityCount} fiche{type.entityCount > 1 ? 's' : ''} ·{' '}
                    {type.activeOwnershipCount} exemplaire{type.activeOwnershipCount > 1 ? 's' : ''} possédé
                    {type.activeOwnershipCount > 1 ? 's' : ''} · {type.experienceCount} expérience
                    {type.experienceCount > 1 ? 's' : ''}
                    {type.averageRating !== null && ` · note moyenne ${formaterDecimal(type.averageRating)}/10`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          )}

          {statsQuery.data.topTags.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-semibold text-textPrimary">Tags les plus utilisés</h2>
              <ul className="divide-y divide-surface2 rounded-xl bg-surface">
                {statsQuery.data.topTags.map((tag) => (
                  <li key={tag.label} className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-textPrimary">{tag.label}</span>
                    <span className="text-textDim">{tag.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

    </div>
  )
}
