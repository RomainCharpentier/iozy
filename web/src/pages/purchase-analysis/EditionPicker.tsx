import { useQuery } from '@tanstack/react-query'
import { searchEditionsForSeries } from '@/common/api/purchaseAnalysis'

/**
 * Choose the edition of a batch without having to guess it.
 *
 * The field was free, with no list and no usable example: you had to type
 * "Standard" or "Perfect Edition" from memory. Two ways to get it wrong,
 * and the second is silent:
 *
 * - the label matches nothing in the catalogue → the analysis still runs
 *   but carries a fictitious label;
 * - the label matches **by accident** another edition → the market
 *   reference is wrong, and nothing signals it.
 *
 * So we offer what really exists for this series, plus an
 * explicit "I do not know" choice. Declaring one's ignorance is better than
 * inventing: the analysis knows it and degrades honestly (unknown completeness,
 * no new value), instead of computing on a fiction.
 */

/**
 * Must stay identical to {@code ListingItem.EDITION_INCONNUE} on the backend:
 * this exact label triggers the message "the edition is not
 * specified" rather than "complete its detail page", which would be an
 * inapplicable piece of advice.
 */
export const EDITION_INCONNUE = 'Édition inconnue'

export function EditionPicker({
  seriesTitle,
  value,
  onChange,
  inputId,
  ariaLabel,
}: {
  seriesTitle: string
  value: string
  onChange: (editionName: string) => void
  inputId?: string
  ariaLabel?: string
}) {
  const serie = seriesTitle.trim()

  const editionsQuery = useQuery({
    queryKey: ['purchase-analysis', 'editions', 'search', serie.toLowerCase()],
    queryFn: () => searchEditionsForSeries(serie),
    // Nothing to search while the series is not named, and no need to
    // ask the server for two letters.
    enabled: serie.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  const connues = editionsQuery.data ?? []
  const dejaProposee = connues.some((edition) => edition.editionName === value)

  return (
    <div className="flex flex-col gap-1.5">
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ex: Perfect Edition"
        aria-label={ariaLabel}
        autoComplete="off"
        className="champ"
      />

      <div className="flex flex-wrap gap-1.5">
        {connues.map((edition) => (
          <button
            key={edition.id}
            type="button"
            onClick={() => onChange(edition.editionName)}
            aria-pressed={value === edition.editionName}
            className={`min-h-11 rounded-lg px-3 text-xs font-medium ${
              value === edition.editionName
                ? 'bg-accent text-accentInk'
                : 'bg-surface2 text-textPrimary hover:bg-surface'
            }`}
          >
            {edition.editionName}
            {edition.totalVolumes !== null && (
              <span className="ml-1 opacity-70">· {edition.totalVolumes} tomes</span>
            )}
          </button>
        ))}

        {/* Always offered, even when editions are proposed: the
            catalogue may perfectly well not know the one we have in front of us. */}
        <button
          type="button"
          onClick={() => onChange(EDITION_INCONNUE)}
          aria-pressed={value === EDITION_INCONNUE}
          className={`min-h-11 rounded-lg px-3 text-xs font-medium ${
            value === EDITION_INCONNUE
              ? 'bg-accent text-accentInk'
              : 'bg-surface2 text-textDim hover:bg-surface'
          }`}
        >
          Je ne sais pas
        </button>
      </div>

      {value === EDITION_INCONNUE && (
        <p className="text-xs text-textDim">
          L'analyse fonctionnera, mais sans la complétude ni la valeur neuve — elles dépendent de
          l'édition.
        </p>
      )}

      {serie.length >= 3 && !editionsQuery.isPending && connues.length === 0 && (
        <p className="text-xs text-textDim">
          Aucune édition connue pour « {serie} ». Saisis son nom si tu le lis sur l'annonce.
        </p>
      )}

      {value.trim() && !dejaProposee && value !== EDITION_INCONNUE && connues.length > 0 && (
        <p className="text-xs text-textDim">
          « {value} » n'est pas encore au catalogue — l'analyse tournera, sans référence de prix pour
          cette édition.
        </p>
      )}
    </div>
  )
}
