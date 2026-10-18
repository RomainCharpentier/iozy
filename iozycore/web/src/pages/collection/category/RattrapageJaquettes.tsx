import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { mergeVariantAttributes } from '@/common/api/entities'
import { searchVolumes } from '@/common/api/metadata'
import { rattraperJaquettes, variantsMissingCover } from '@/common/lib/backfillCovers'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EntityResponse } from '@/common/types/api'

/**
 * "Retrouver les jaquettes manquantes": the tool of the Manga shelf.
 *
 * <h2>Why here, and no longer in "Plus d'outils" of My collection</h2>
 * It never handled anything but mangas - it queries the volume provider,
 * which exists only for them - and it lived in the tools menu of the
 * home page, that is of the WHOLE collection. My collection belongs to the
 * core: what is specific to a universe plugs into its shelf (batch 136).
 *
 * <p>On the whole owned collection of this type, never on the displayed
 * list: it is a maintenance tool, not an action on what is
 * filtered. Sequential, never parallel - each series potentially costs
 * a real Google Books call, and a simultaneous batch would use up the quota at once
 * instead of stopping cleanly on it. The work of ONE series lives in
 * `rattraperJaquettes`, shared with the detail page.
 */
export function RattrapageJaquettes({
  oeuvresPossedees,
  mangaTypeId,
}: {
  /** The owned mangas of this account - owned, because one does not complete the cover of a wish. */
  oeuvresPossedees: EntityResponse[]
  mangaTypeId: string
}) {
  const queryClient = useQueryClient()
  const aTraiter = useMemo(
    () => oeuvresPossedees.filter((e) => variantsMissingCover(e).length > 0),
    [oeuvresPossedees],
  )
  const [etat, setEtat] = useState<{
    running: boolean
    processed: number
    total: number
    found: number
    fournisseurMuet: boolean
  } | null>(null)

  async function lancer() {
    if (aTraiter.length === 0) return
    setEtat({ running: true, processed: 0, total: aTraiter.length, found: 0, fournisseurMuet: false })
    let found = 0
    let fournisseurMuet = false
    let processed = 0
    for (let i = 0; i < aTraiter.length; i++) {
      const resultat = await rattraperJaquettes(aTraiter[i], mangaTypeId, searchVolumes, (entityId, variantId, url) =>
        mergeVariantAttributes(entityId, variantId, { coverImageUrl: url }),
      )
      found += resultat.trouvees
      if (resultat.fournisseurMuet) {
        // The series where the provider went silent is not done: it stays
        // among those to try again.
        fournisseurMuet = true
        break
      }
      processed = i + 1
      setEtat({ running: true, processed, total: aTraiter.length, found, fournisseurMuet })
    }
    setEtat({ running: false, processed, total: aTraiter.length, found, fournisseurMuet })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={lancer}
        disabled={aTraiter.length === 0 || etat?.running}
        className="flex min-h-11 w-fit items-center gap-2 rounded-xl border border-fieldBorder px-3.5 text-sm font-semibold text-textDim transition-colors hover:bg-rowHover disabled:opacity-40"
      >
        <ImagePlus size={15} />
        {etat?.running ? `Jaquettes… ${etat.processed}/${etat.total}` : 'Retrouver les jaquettes manquantes'}
        {!etat?.running && aTraiter.length > 0 && <span className="text-xs font-normal">{aTraiter.length}</span>}
      </button>
      {etat && !etat.running && (
        <p className="text-xs text-textDim">
          {etat.found > 0
            ? `${etat.found} jaquette${etat.found > 1 ? 's' : ''} retrouvée${etat.found > 1 ? 's' : ''}.`
            : 'Aucune jaquette retrouvée cette fois.'}
          {etat.fournisseurMuet && ` ${phraseFournisseurMuet(etat.processed, etat.total)}`}
        </p>
      )}
    </div>
  )
}

/** Only said when the provider stopped answering: how far the run went, and what is left. */
function phraseFournisseurMuet(processed: number, total: number): string {
  if (processed === 0) return "Le fournisseur n'a pas répondu : aucune série traitée, réessaie plus tard."
  const reste = total - processed
  return `Le fournisseur a cessé de répondre après ${processed} série${processed > 1 ? 's' : ''} sur ${total} : réessaie plus tard pour ${
    reste > 1 ? `les ${reste} autres` : "l'autre"
  }.`
}
