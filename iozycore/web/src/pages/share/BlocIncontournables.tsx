import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import type { WorkProgressDto } from '@/common/types/api'
import { candidats, MAX_INCONTOURNABLES } from './libelles'

/**
 * "Mes 4 incontournables" (lot 217): the works shown first, and big, on the
 * public page. Chosen among what is owned (a wish would show the wishes to a
 * visitor of a collection-only link). Each change is saved at once; the order
 * is the order of the clicks.
 */
export function BlocIncontournables({
  oeuvres,
  epinglees,
  onChanger,
  enCours,
  erreur,
}: {
  oeuvres: WorkProgressDto[]
  epinglees: string[]
  onChanger: (ids: string[]) => void
  enCours: boolean
  erreur: string | null
}) {
  const [recherche, setRecherche] = useState('')
  const parId = useMemo(() => new Map(oeuvres.map((o) => [o.entityId, o])), [oeuvres])
  const choisies = epinglees.map((id) => parId.get(id)).filter((o): o is WorkProgressDto => !!o)
  const plein = choisies.length >= MAX_INCONTOURNABLES
  const proposees = candidats(oeuvres, epinglees, recherche).slice(0, 12)

  return (
    <section aria-labelledby="titre-incontournables" className="iozy-verre iozy-verre--fort flex flex-col gap-4 rounded-3xl p-5">
      <div className="flex flex-col gap-1">
        <h2 id="titre-incontournables" className="text-[13px] font-semibold tracking-[0.12em] text-textDim uppercase">
          Mes incontournables
        </h2>
        <p className="text-sm text-textDim">
          Jusqu’à quatre œuvres de ta collection, en tête de ta page et en grand.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: MAX_INCONTOURNABLES }, (_, i) => choisies[i]).map((oeuvre, i) =>
          oeuvre ? (
            <li key={oeuvre.entityId} className="relative">
              <div className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface2">
                <Jaquette
                  src={oeuvre.coverImageUrl}
                  className="h-full w-full object-cover"
                  repli={<span className="flex h-full items-center justify-center p-1 text-center text-xs text-textDim">{oeuvre.title}</span>}
                />
              </div>
              <button
                type="button"
                disabled={enCours}
                onClick={() => onChanger(epinglees.filter((id) => id !== oeuvre.entityId))}
                aria-label={`Retirer ${oeuvre.title} de mes incontournables`}
                className="iozy-verre absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full text-textPrimary"
              >
                <X size={16} />
              </button>
            </li>
          ) : (
            <li
              key={`vide-${i}`}
              aria-hidden="true"
              className="aspect-[2/3] w-full rounded-xl border border-dashed border-ligneVerre"
            />
          ),
        )}
      </ul>
      {choisies.length === 0 && (
        <p className="text-sm text-textDim">Aucun pour l’instant : ta page s’ouvre directement sur ta collection.</p>
      )}

      {erreur && <ErrorBanner message={erreur} />}

      {plein ? (
        <p className="text-sm text-textDim">Quatre au plus : retire-en un pour en choisir un autre.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-textPrimary">
            Chercher dans ma collection
            <input
              className="champ"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Un titre"
            />
          </label>
          {proposees.length === 0 ? (
            <p className="text-sm text-textDim">
              {oeuvres.some((o) => o.ownedCount > 0) ? 'Aucune œuvre ne correspond.' : 'Ta collection est vide pour l’instant.'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {proposees.map((oeuvre) => (
                <li key={oeuvre.entityId}>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => onChanger([...epinglees, oeuvre.entityId])}
                    aria-label={`Épingler ${oeuvre.title}`}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-hoverSurface"
                  >
                    <span className="aspect-[2/3] w-8 shrink-0 overflow-hidden rounded-md bg-surface2">
                      <Jaquette src={oeuvre.coverImageUrl} className="h-full w-full object-cover" repli={null} />
                    </span>
                    <span className="truncate text-sm text-textPrimary">{oeuvre.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
