import { useQuery } from '@tanstack/react-query'
import { getStats } from '../../api/insights'
import { queryKeys } from '../../lib/queryKeys'
import { StatCard } from '../../components/StatCard'
import { ErrorBanner } from '../../components/ErrorBanner'
import { DiscoverySection } from './DiscoverySection'
import { CollectionTimelineSection } from './CollectionTimelineSection'

export function StatsPage() {
  // Toujours à jour, jamais de cache - une donnée périmée n'a pas de sens
  // pour des statistiques (même choix explicite que côté iOS).
  const statsQuery = useQuery({
    queryKey: queryKeys.insights.stats,
    queryFn: getStats,
    staleTime: 0,
    gcTime: 0,
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Statistiques</h1>

      {statsQuery.isError && <ErrorBanner message={statsQuery.error.message} />}
      {statsQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {statsQuery.data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={String(statsQuery.data.totalEntities)} label="Entités" />
            <StatCard value={String(statsQuery.data.totalActiveOwnerships)} label="Possédés" />
            <StatCard value={String(statsQuery.data.wishlistCount)} label="Wishlist" />
            <StatCard value={String(statsQuery.data.experiencesThisYear)} label="Expériences cette année" />
          </div>

          <CollectionTimelineSection />

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-textPrimary">Par type</h2>
            <ul className="flex flex-col gap-2">
              {statsQuery.data.byType.map((type) => (
                <li key={type.entityTypeCode} className="rounded-xl bg-surface p-3">
                  <p className="font-medium text-textPrimary">{type.entityTypeLabel}</p>
                  <p className="text-sm text-textDim">
                    {type.entityCount} au total · {type.activeOwnershipCount} possédé(s) · {type.experienceCount}{' '}
                    expérience(s)
                    {type.averageRating !== null && ` · note moyenne ${type.averageRating.toFixed(1)}/10`}
                  </p>
                </li>
              ))}
            </ul>
          </section>

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

      <DiscoverySection />
    </div>
  )
}
