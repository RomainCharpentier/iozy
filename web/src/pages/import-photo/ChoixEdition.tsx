import { ChevronDown } from 'lucide-react'
import { editionNommee } from './editionNommee'

/**
 * The edition of a series, picked once from a drop-down list - nothing typed and no
 * "unknown": an edition has a name. The list and the default pick come from the page
 * (see `useEditionsDesSeries`): the default is set only when there is a single choice,
 * otherwise the field starts empty.
 *
 * <p>The native arrow is replaced by one of ours, drawn inside the field with room
 * for it, so a long edition name is cut with an ellipsis instead of running under it.
 * The field takes the full width on a phone and a readable width beyond.
 */
export function ChoixEdition({
  proposees,
  enRecherche,
  editionLue,
  choisie,
  onEdition,
}: {
  proposees: string[]
  /** The sources are being asked: the list may still grow. */
  enRecherche: boolean
  /** Said on the matching choice: the photo is worth proposing even when the catalog knows other editions. */
  editionLue: string | null
  /** The name picked or defaulted; empty = nothing yet. */
  choisie: string
  onEdition: (editionName: string) => void
}) {
  const manquante = !enRecherche && !editionNommee(choisie)

  return (
    <div className="flex w-full min-w-0 flex-col gap-1 sm:max-w-sm">
      <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-textDim">
        Édition
        <span className="relative block">
          <select
            value={choisie}
            onChange={(e) => onEdition(e.target.value)}
            disabled={enRecherche}
            aria-invalid={manquante}
            className="champ w-full min-w-0 cursor-pointer appearance-none truncate pr-10 text-sm font-normal"
          >
            <option value="">{enRecherche ? 'Recherche des éditions…' : 'Choisir une édition'}</option>
            {proposees.map((nom) => (
              <option key={nom} value={nom}>
                {nom === editionLue ? `${nom} (lu sur la photo)` : nom}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-textDim"
          />
        </span>
      </label>
      {manquante && <span className="text-xs text-warning">À choisir pour pouvoir ajouter.</span>}
    </div>
  )
}
