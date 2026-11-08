import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { mergeEntityAttributes } from '@/common/api/entities'
import { detailsOeuvre } from '@/common/api/metadata'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EntityResponse } from '@/common/types/api'

function identifiantsDeLaSource(oeuvre: EntityResponse): Record<string, string> {
  const identifiants: Record<string, string> = {}
  for (const cle of ['igdbId', 'bggId']) {
    const valeur = oeuvre.attributes[cle]
    if (typeof valeur === 'string' && valeur.trim() !== '') identifiants[cle] = valeur.trim()
  }
  return identifiants
}

/** What a work added before batch 203 lacks to be shelved. Without a source id, nothing can be asked. */
function resteACompleter(oeuvre: EntityResponse): boolean {
  const identifiants = identifiantsDeLaSource(oeuvre)
  if (Object.keys(identifiants).length === 0) return false
  return !oeuvre.attributes.publisher || (Boolean(identifiants.igdbId) && !oeuvre.attributes.platforms)
}

/**
 * "Compléter les éditeurs": the works added before the shelves were arranged
 * by publisher kept none. On the shelf page, like the tool for the covers.
 * The server also does this by itself every hour (ShelfDetailsBackfill); the
 * button stays for right after an add, so nobody waits for the next run.
 *
 * <p>Sequential, one call per work, and it stops at the first silence: a batch
 * would use up a quota instead of stopping cleanly on it. It writes as a source,
 * so what was typed by hand stays (see mergeEntityAttributes).
 */
export function RattrapageEditeurs({
  oeuvresPossedees,
  entityTypeId,
}: {
  oeuvresPossedees: EntityResponse[]
  entityTypeId: string
}) {
  const queryClient = useQueryClient()
  const aTraiter = useMemo(() => oeuvresPossedees.filter(resteACompleter), [oeuvresPossedees])
  const [etat, setEtat] = useState<{ enCours: boolean; faites: number; trouves: number; muet: boolean } | null>(null)

  async function lancer() {
    let faites = 0
    let trouves = 0
    let muet = false
    setEtat({ enCours: true, faites, trouves, muet })
    for (const oeuvre of aTraiter) {
      try {
        const details = await detailsOeuvre(entityTypeId, identifiantsDeLaSource(oeuvre))
        const aEcrire: Record<string, unknown> = {}
        for (const cle of ['publisher', 'platforms']) {
          if (typeof details[cle] === 'string' && !oeuvre.attributes[cle]) aEcrire[cle] = details[cle]
        }
        if (Object.keys(aEcrire).length > 0) {
          await mergeEntityAttributes(oeuvre.id, aEcrire, 'source')
          trouves++
        }
      } catch {
        muet = true
        break
      }
      faites++
      setEtat({ enCours: true, faites, trouves, muet })
    }
    setEtat({ enCours: false, faites, trouves, muet })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  if (aTraiter.length === 0 && !etat) return null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={lancer}
        disabled={aTraiter.length === 0 || etat?.enCours}
        className="flex min-h-11 w-fit items-center gap-2 rounded-xl border border-fieldBorder px-3.5 text-sm font-semibold text-textDim transition-colors hover:bg-rowHover disabled:opacity-40"
      >
        <Building2 size={15} />
        {etat?.enCours ? `Éditeurs… ${etat.faites}/${aTraiter.length}` : 'Compléter les éditeurs'}
        {!etat?.enCours && aTraiter.length > 0 && <span className="text-xs font-normal">{aTraiter.length}</span>}
      </button>
      {etat && !etat.enCours && (
        <p className="text-xs text-textDim">
          {etat.trouves > 0
            ? `${etat.trouves} œuvre${etat.trouves > 1 ? 's' : ''} complétée${etat.trouves > 1 ? 's' : ''}.`
            : 'Rien de nouveau cette fois.'}
          {etat.muet && " Le fournisseur n'a plus répondu : réessaie plus tard pour le reste."}
        </p>
      )}
    </div>
  )
}
