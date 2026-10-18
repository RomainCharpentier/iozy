import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchEditionsForSeries } from '@/common/api/purchaseAnalysis'
import { EditionPicker, EDITION_INCONNUE } from './EditionPicker'

/**
 * The edition, presented as a **result** and not as a question.
 *
 * <h2>The change</h2>
 * The form asked for "Édition" with only "ex: Perfect
 * Edition" as a guide, between the series and the volumes, on the critical path. It was the
 * only step of the product where the user was forced to know something
 * that the catalogue often knows better than they do - and to invent otherwise.
 *
 * The order is reversed: we enter the series and the volumes, then IozyCore looks for
 * the edition and shows what it found. Three states, all usable:
 *
 * <ul>
 *   <li><b>resolved</b> - a single known edition for this series, kept,
 *       editable in one click;</li>
 *   <li><b>to confirm</b> - several candidates, offered without any
 *       being chosen by default;</li>
 *   <li><b>undetermined</b> - nothing in the catalogue. The analysis stays possible:
 *       the engine degrades honestly (unknown completeness, new value
 *       unavailable) rather than blocking.</li>
 * </ul>
 *
 * In none of these cases does the edition prevent evaluating the batch.
 */
export function EditionStatusRow({
  seriesTitle,
  value,
  onChange,
}: {
  seriesTitle: string
  /** Empty = not decided yet; the analysis will treat it as unknown. */
  value: string
  onChange: (editionName: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const serie = seriesTitle.trim()

  const editionsQuery = useQuery({
    queryKey: ['purchase-analysis', 'editions', 'search', serie.toLowerCase()],
    queryFn: () => searchEditionsForSeries(serie),
    enabled: serie.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  /**
   * Memoised, and not only to silence the linter: `?? []` creates a
   * NEW array on each render until the query has answered, so
   * the effect below re-ran on each render. It exited right away
   * - an empty list never has a single edition - so nothing
   * broke, but the dependency lied about what makes it change.
   */
  const connues = useMemo(() => editionsQuery.data ?? [], [editionsQuery.data])

  /**
   * A single edition in the catalogue is adopted for good, not only
   * displayed.
   *
   * Without this, the screen announced "Édition · Black Édition" while the batch
   * saved "Édition inconnue": the display deduced the single edition
   * locally without ever passing it up. Promising one thing and analysing
   * another is worse than offering nothing.
   */
  useEffect(() => {
    if (value.trim()) return
    if (connues.length !== 1) return
    onChange(connues[0].editionName)
  }, [value, connues, onChange])

  if (serie.length < 3) return null

  if (ouvert) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-textDim">Édition</span>
        <EditionPicker
          seriesTitle={serie}
          value={value}
          onChange={(nom) => {
            onChange(nom)
            setOuvert(false)
          }}
          ariaLabel={`Édition de ${serie}`}
        />
      </div>
    )
  }

  if (editionsQuery.isPending) {
    return <p className="text-xs text-textDim">Recherche de l'édition…</p>
  }

  // Explicit choice of the user, or single edition of the catalogue: we
  // display what will be used, not a question.
  const retenue = value.trim()

  if (retenue && retenue !== EDITION_INCONNUE) {
    return (
      <LigneEtat
        libelle="Édition"
        valeur={retenue}
        action="Modifier"
        onAction={() => setOuvert(true)}
      />
    )
  }

  if (retenue === EDITION_INCONNUE) {
    return (
      <LigneEtat
        libelle="Édition"
        valeur="non déterminée"
        detail="L'analyse fonctionnera, sans la complétude ni la valeur neuve."
        action="Préciser"
        onAction={() => setOuvert(true)}
      />
    )
  }

  if (connues.length > 1) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-textDim">Édition à confirmer</span>
        <div className="flex flex-wrap gap-1.5">
          {connues.map((edition) => (
            <button
              key={edition.id}
              type="button"
              onClick={() => onChange(edition.editionName)}
              className="btn-secondaire"
            >
              {edition.editionName}
              {edition.totalVolumes !== null && (
                <span className="ml-1 opacity-70">· {edition.totalVolumes} tomes</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(EDITION_INCONNUE)}
            className="min-h-11 rounded-lg bg-surface2 px-3 text-xs font-medium text-textDim"
          >
            Je ne sais pas
          </button>
        </div>
      </div>
    )
  }

  // Nothing in the catalogue: we say so, and we do not make it an obstacle.
  return (
    <LigneEtat
      libelle="Édition"
      valeur="non déterminée"
      detail="Aucune édition connue pour cette série. L'analyse reste possible."
      action="Préciser"
      onAction={() => setOuvert(true)}
    />
  )
}

function LigneEtat({
  libelle,
  valeur,
  detail,
  action,
  onAction,
}: {
  libelle: string
  valeur: string
  detail?: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-textDim">
          {libelle} · <span className="font-medium text-textPrimary">{valeur}</span>
        </span>
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 rounded-lg px-2 text-xs font-semibold text-accent underline underline-offset-2"
        >
          {action}
        </button>
      </div>
      {detail && <span className="text-xs text-textDim">{detail}</span>}
    </div>
  )
}
