import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getNearCompleteSuggestions } from '@/common/api/purchaseAnalysis'
import { searchEntities } from '@/common/api/entities'
import { queryKeys } from '@/common/lib/queryKeys'
import { coverImageUrlFrom } from '@/common/lib/coverImage'
import { libelleBaseCourt } from '@/common/lib/basePrix'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { formaterEuros } from '@/common/lib/formats'
import { Squelette } from '@/common/components/Squelette'

const MAX_PREVIEW = 3

/**
 * "Opportunités" panel of Découvrir (see DS v1.1 section 44) - adapted from the existing
 * "Suggestions d'achats" engine (PurchaseAnalysisService.
 * findNearCompleteSuggestions): owned series that are almost complete,
 * sorted by number of missing volumes. "The reason, always written" (see
 * the source comment of the mock) - never a bare price card without explaining
 * why it is there. "Tout voir" is a link to the existing Suggestions
 * screen, like the one of the releases panel, rather than a copy of the full list here.
 */
export function DiscoverOpportunitiesPreview() {
  const navigate = useNavigate()
  const suggestionsQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.nearCompleteSuggestions,
    queryFn: getNearCompleteSuggestions,
  })
  // Covers: the suggestion does not carry coverImageUrl (computed data,
  // not an entity DTO) - reuses the already warm cache of My collection
  // when available rather than a new dedicated endpoint for 3 thumbnails.
  const entitiesQuery = useQuery({ queryKey: queryKeys.entities.search({}), queryFn: () => searchEntities({}) })

  const suggestions = (suggestionsQuery.data ?? []).slice(0, MAX_PREVIEW)
  const coverByEntityId = new Map((entitiesQuery.data ?? []).map((e) => [e.id, coverImageUrlFrom(e.attributes)]))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Ce qui te concerne</h2>
        <Link to="/suggestions" className="flex min-h-11 items-center text-sm font-semibold text-accentText">
          Tout voir
        </Link>
      </div>

      {suggestionsQuery.isError && <ErrorBanner message={suggestionsQuery.error.message} />}
      {suggestionsQuery.isLoading && <Squelette lignes={3} />}

      {suggestionsQuery.isSuccess && suggestions.length === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="text-sm font-semibold text-textPrimary">Aucune opportunité pertinente pour le moment.</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {suggestions.map((s) => {
          const base = libelleBaseCourt(s.costToCompleteBasis)
          return (
          <button
            key={`${s.entityId}-${s.editionName}`}
            type="button"
            onClick={() => navigate(`/entity/${s.entityId}`)}
            className="flex w-full items-center gap-3 rounded-2xl border border-surface2 bg-surface p-3 text-left shadow-token-sm transition-transform hover:-translate-y-0.5"
          >
            <Jaquette
              src={coverByEntityId.get(s.entityId)}
              className="h-[58px] w-10 shrink-0 rounded-md object-cover"
              repli={<span className="h-[58px] w-10 shrink-0 rounded-md bg-surface2" />}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <TexteCoupe texte={s.seriesTitle} className="truncate text-sm font-semibold text-textPrimary" />
              <TexteCoupe texte={s.editionName} className="truncate text-xs text-textDim" />
              {/* The reason, always written: otherwise it is a page of promotions. */}
              <span className="text-xs font-semibold text-accentText">
                {s.missingCount} tome{s.missingCount > 1 ? 's' : ''} manquant{s.missingCount > 1 ? 's' : ''} pour compléter
                {s.estimatedCostToComplete !== null &&
                  ` · ~${formaterEuros(s.estimatedCostToComplete)}${base === null ? '' : ` (${base})`}`}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accentInk">
              {s.ownedCount}/{s.totalVolumes}
            </span>
          </button>
          )
        })}
      </div>

      {/* No more "Évaluer une annonce" link here: since batch 137, the entry
          of the analysis is at the top of Découvrir, on all the tabs - a
          second link in this panel would only have doubled it. */}
    </div>
  )
}
