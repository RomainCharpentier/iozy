import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNearCompleteSuggestions } from '@/common/api/purchaseAnalysis'
import { searchEntities } from '@/common/api/entities'
import { queryKeys } from '@/common/lib/queryKeys'
import { coverImageUrlFrom } from '@/common/lib/coverImage'
import { libelleBaseCourt } from '@/common/lib/basePrix'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_CARTE } from '@/common/components/Carte'

const MAX_PREVIEW = 3

/**
 * Panneau "Opportunités" de Découvrir (voir DS v1.1 §44) - adapté du moteur
 * "Suggestions d'achats" déjà existant (PurchaseAnalysisService.
 * findNearCompleteSuggestions) : séries possédées presque complètes,
 * triées par nombre de tomes manquants. "La raison, toujours écrite" (voir
 * commentaire source du mock) - jamais une carte prix nu sans expliquer
 * pourquoi elle est là. "Voir tout" renvoie vers l'écran Suggestions
 * existant plutôt que dupliquer la liste complète ici.
 */
export function DiscoverOpportunitiesPreview() {
  const navigate = useNavigate()
  const suggestionsQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.nearCompleteSuggestions,
    queryFn: getNearCompleteSuggestions,
  })
  // Jaquettes : la suggestion ne porte pas coverImageUrl (donnée calculée,
  // pas un DTO d'entité) - réutilise le cache déjà chaud de Ma collection
  // le cas échéant plutôt qu'un nouvel endpoint dédié pour 3 miniatures.
  const entitiesQuery = useQuery({ queryKey: queryKeys.entities.search({}), queryFn: () => searchEntities({}) })

  const suggestions = (suggestionsQuery.data ?? []).slice(0, MAX_PREVIEW)
  const coverByEntityId = new Map((entitiesQuery.data ?? []).map((e) => [e.id, coverImageUrlFrom(e.attributes)]))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Ce qui te concerne</h2>
        <button type="button" onClick={() => navigate('/suggestions')} className="min-h-11 text-sm font-semibold text-accentText">
          Tout voir
        </button>
      </div>

      {suggestionsQuery.isError && <ErrorBanner message={suggestionsQuery.error.message} />}
      {suggestionsQuery.isLoading && <p className="text-sm text-textDim">Chargement...</p>}

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
              {/* La raison, toujours écrite : sinon c'est une page de promos. */}
              <span className="text-xs font-semibold text-accentText">
                {s.missingCount} tome{s.missingCount > 1 ? 's' : ''} manquant{s.missingCount > 1 ? 's' : ''} pour compléter
                {s.estimatedCostToComplete !== null &&
                  ` · ~${s.estimatedCostToComplete.toFixed(2)} €${base === null ? '' : ` (${base})`}`}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accentInk">
              {s.ownedCount}/{s.totalVolumes}
            </span>
          </button>
          )
        })}
      </div>

      {/* Plus de lien « Évaluer une annonce » ici : depuis le lot 137, la porte
          de l'analyse est en tête de Découvrir, sur tous les onglets - un
          second lien dans ce panneau n'aurait fait que la doubler. */}
    </div>
  )
}
