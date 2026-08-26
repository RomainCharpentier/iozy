import { useQuery } from '@tanstack/react-query'
import { Scale } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getNearCompleteSuggestions } from '../../api/purchaseAnalysis'
import { searchEntities } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { ErrorBanner } from '../../components/ErrorBanner'
import { TexteCoupe } from '../../components/TexteCoupe'
import { Jaquette } from '../../components/Jaquette'
import { CLASSE_CARTE } from '../../components/Carte'

const MAX_PREVIEW = 3

function basisLabel(basis: 'OBSERVED_MARKET' | 'AI_ESTIMATED' | 'THEORETICAL_ONLY' | null): string {
  if (basis === 'OBSERVED_MARKET') return 'marché'
  if (basis === 'AI_ESTIMATED') return 'estimation IA'
  return 'théorique'
}

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
        {suggestions.map((s) => (
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
                {s.estimatedCostToComplete !== null && ` · ~${s.estimatedCostToComplete.toFixed(2)} € (${basisLabel(s.costToCompleteBasis)})`}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accentInk">
              {s.ownedCount}/{s.totalVolumes}
            </span>
          </button>
        ))}
      </div>

      {/* Le pendant naturel des opportunités : elles disent ce qu'il manque,
          ceci permet de juger une annonce trouvée ailleurs. Discret - la même
          route que « Évaluer un achat », pas une fonctionnalité de plus. */}
      <button
        type="button"
        onClick={() => navigate('/purchase-analysis')}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2 text-xs font-semibold text-accent underline underline-offset-2"
      >
        <Scale size={13} />
        Évaluer une annonce
      </button>
    </div>
  )
}
