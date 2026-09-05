import { useQuery } from '@tanstack/react-query'
import { searchEditionsForSeries } from '@/common/api/purchaseAnalysis'

/**
 * Choisir l'édition d'un lot sans avoir à la deviner.
 *
 * Le champ était libre, sans liste ni exemple utilisable : il fallait taper
 * « Standard » ou « Perfect Edition » de mémoire. Deux façons de se tromper,
 * et la seconde est silencieuse :
 *
 * - le libellé ne correspond à rien au catalogue → l'analyse tourne quand même
 *   mais porte une étiquette fictive ;
 * - le libellé correspond **par accident** à une autre édition → la référence
 *   marché est fausse, sans que rien ne le signale.
 *
 * On propose donc ce qui existe réellement pour cette série, plus un choix
 * explicite « je ne sais pas ». Déclarer son ignorance vaut mieux que
 * l'inventer : l'analyse le sait et dégrade honnêtement (complétude inconnue,
 * pas de valeur neuve), au lieu de calculer sur une fiction.
 */

/**
 * Doit rester identique à {@code ListingItem.EDITION_INCONNUE} côté backend :
 * c'est ce libellé exact qui déclenche le message « l'édition n'est pas
 * précisée » plutôt que « complète sa fiche », lequel serait un conseil
 * inapplicable.
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
    // Rien à chercher tant que la série n'est pas nommée, et pas la peine de
    // solliciter le serveur sur deux lettres.
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
        className="min-h-11 rounded-lg bg-surface2 px-3 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                ? 'bg-accent text-accentText'
                : 'bg-surface2 text-textPrimary hover:bg-surface'
            }`}
          >
            {edition.editionName}
            {edition.totalVolumes !== null && (
              <span className="ml-1 opacity-70">· {edition.totalVolumes} tomes</span>
            )}
          </button>
        ))}

        {/* Toujours offert, même quand des éditions sont proposées : le
            catalogue peut parfaitement ignorer celle qu'on a sous les yeux. */}
        <button
          type="button"
          onClick={() => onChange(EDITION_INCONNUE)}
          aria-pressed={value === EDITION_INCONNUE}
          className={`min-h-11 rounded-lg px-3 text-xs font-medium ${
            value === EDITION_INCONNUE
              ? 'bg-accent text-accentText'
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
