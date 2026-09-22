import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getNearCompleteSuggestions } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { libelleBaseCourt } from '@/common/lib/basePrix'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { formaterEuros } from '@/common/lib/formats'

/** "Suggestions d'achats" (Mon profil) - séries déjà en collection dont une
 * édition nommée est connue mais incomplète, les plus proches de la
 * complétion en premier (voir PurchaseAnalysisService.findNearCompleteSuggestions
 * côté backend, même moteur que la complétude affichée sur une fiche série). */
export function SuggestionsPage() {
  const navigate = useNavigate()
  const suggestionsQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.nearCompleteSuggestions,
    queryFn: getNearCompleteSuggestions,
  })

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/discover', libelle: 'Découvrir' }} />

      <EnTeteSection
        niveau={1}
        titre="Suggestions d'achats"
        sousTitre="Séries que tu possèdes déjà, dont il ne manque plus que quelques tomes pour compléter l'édition."
      />

      {suggestionsQuery.isError && <ErrorBanner message={suggestionsQuery.error.message} />}
      {suggestionsQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {suggestionsQuery.isSuccess && suggestionsQuery.data.length === 0 && (
        <p className="text-textDim">
          Rien à suggérer pour l'instant - ça se remplit au fur et à mesure que tu renseignes des éditions connues
          (voir "Éditions" sur une fiche série).
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {(suggestionsQuery.data ?? []).map((suggestion) => {
          const base = libelleBaseCourt(suggestion.costToCompleteBasis)
          return (
          <li key={`${suggestion.entityId}-${suggestion.editionName}`}>
            <button
              type="button"
              onClick={() => navigate(`/entity/${suggestion.entityId}`)}
              className="flex w-full flex-col gap-1 rounded-xl bg-surface p-3 text-left"
            >
              <p className="font-medium text-textPrimary">
                {suggestion.seriesTitle} <span className="font-normal text-textDim">— {suggestion.editionName}</span>
              </p>
              <p className="text-sm text-textDim">
                {suggestion.ownedCount}/{suggestion.totalVolumes} tomes · {suggestion.missingCount} manquant
                {suggestion.missingCount > 1 ? 's' : ''}
                {suggestion.estimatedCostToComplete !== null && (
                  <>
                    {' '}
                    · ~{formaterEuros(suggestion.estimatedCostToComplete)} pour compléter
                    {base !== null && ` (${base})`}
                  </>
                )}
              </p>
            </button>
          </li>
          )
        })}
      </ul>
    </div>
  )
}
