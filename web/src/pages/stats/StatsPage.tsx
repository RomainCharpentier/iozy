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

export function StatsPage() {

  // Toujours à jour, jamais de cache - une donnée périmée n'a pas de sens
  // pour des statistiques (même choix explicite que côté iOS).
  const statsQuery = useQuery({
    queryKey: queryKeys.insights.stats,
    queryFn: getStats,
    staleTime: 0,
    gcTime: 0,
  })

  // Arriver par « Valeur » (Ma collection) ou par le hero du Profil doit
  // montrer la valeur tout de suite : ces contrôles la NOMMENT, et déposer
  // quelqu'un en haut d'un écran intitulé « Statistiques » lui laisse la
  // chercher. Même patron que Profil ▸ Partager (voir ProfilePage).
  const valeurRef = useRef<HTMLDivElement>(null)
  const focusValeur = (useLocation().state as { focusValeur?: boolean } | null)?.focusValeur
  useEffect(() => {
    if (focusValeur) valeurRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // La section n'EXISTE pas avant que les statistiques arrivent : sans
    // cette dépendance, l'effet cherchait une référence encore vide et
    // laissait la page en haut - le bouton « Valeur » promettait alors une
    // section qu'il fallait quand même aller chercher (constaté en direct).
  }, [focusValeur, statsQuery.data])

  return (
    <div className="flex flex-col gap-6">
      <LienRetour parDefaut={{ to: '/profile', libelle: 'Mon profil' }} />

      <EnTeteSection niveau={1} titre="Statistiques" />

      {statsQuery.isError && <ErrorBanner message={statsQuery.error.message} />}
      {statsQuery.isLoading && <p className="text-textDim">Chargement...</p>}

      {statsQuery.data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {/* « Œuvres » et « Exemplaires », jamais deux fois « possédés ».
                Ma collection compte des ŒUVRES (« 5 titres possédés »), cet
                écran comptait des EXEMPLAIRES sous le même mot : les deux
                chiffres étaient justes et se contredisaient à la lecture
                (5 contre 10). « Entités » disait juste le nom de la table. */}
            <StatCard value={String(statsQuery.data.totalEntities)} label="Œuvres au catalogue" />
            <StatCard value={String(statsQuery.data.totalActiveOwnerships)} label="Exemplaires possédés" />
            <StatCard value={String(statsQuery.data.wishlistCount)} label="Envies" />
            <StatCard value={String(statsQuery.data.experiencesThisYear)} label="Expériences cette année" />
          </div>

          <div id="valeur" ref={valeurRef} className="scroll-mt-4">
            <CollectionValueSection />
          </div>

          <CollectionTimelineSection />

          {/* Gardée comme sa voisine « Tags les plus utilisés » juste en dessous :
              sans cela, le titre « Par type » s'affichait seul, avec rien sous
              lui. Un intertitre orphelin se lit comme un chargement qui n'a
              jamais abouti. */}
          {statsQuery.data.byType.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-textPrimary">Par type</h2>
            <ul className="flex flex-col gap-2">
              {statsQuery.data.byType.map((type) => (
                <li key={type.entityTypeCode} className="rounded-xl bg-surface p-3">
                  <p className="font-medium text-textPrimary">{type.entityTypeLabel}</p>
                  {/* "Fiches" (Entity, ex: une série) et "exemplaires possédés" (Ownership,
                      ex: un tome) sont deux unités différentes - jamais mélangées sous des
                      libellés génériques ("au total"/"possédé(s)") qui ne le précisaient pas,
                      au point de pouvoir lire comme contradictoire (plus "possédé" que
                      "total" est le cas normal pour un manga multi-tomes). */}
                  <p className="text-sm text-textDim">
                    {type.entityCount} fiche{type.entityCount > 1 ? 's' : ''} ·{' '}
                    {type.activeOwnershipCount} exemplaire{type.activeOwnershipCount > 1 ? 's' : ''} possédé
                    {type.activeOwnershipCount > 1 ? 's' : ''} · {type.experienceCount} expérience
                    {type.experienceCount > 1 ? 's' : ''}
                    {type.averageRating !== null && ` · note moyenne ${type.averageRating.toFixed(1)}/10`}
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
