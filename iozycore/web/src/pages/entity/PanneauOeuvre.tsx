import { useState, type ReactNode } from 'react'
import type { CollectorStatus, WorkDto } from '@/common/types/api'
import { LIBELLES_STATUT, phraseDesManques, phraseDuCompte, phraseProchaineSortie } from './elementsOeuvre'

/**
 * The glass panel of the entity page (lot 213, mock-up "A · plein cadre"):
 * the count in very large figures, the ring in the vivid tone, what is
 * missing, the next release, then the grid of the elements.
 *
 * <h2>A total nobody knows</h2>
 * The count then stands alone, with "total inconnu" - never a guessed
 * denominator. When the work is counted in editions, the total can be typed
 * in place, says where a known one comes from, and can be cleared.
 */
export function PanneauOeuvre({
  work,
  consultation,
  total,
  statut,
  miseDeCote,
  grille,
  avecGeste,
  question,
}: {
  work: WorkDto
  consultation: boolean
  total: ReactNode
  /** The collector status control; absent for a visitor. */
  statut?: ReactNode
  /** The "mettre de côté" gesture, when there is something to set aside. */
  miseDeCote?: ReactNode
  grille: ReactNode
  /** At least one element not owned can be owned in one click: only then the hint invites to click. */
  avecGeste: boolean
  /** A question the last gesture asks before it runs (which console), in place. */
  question?: ReactNode
}) {
  const totalConnu = work.totalCount !== null
  return (
    <section aria-label="Ma collection de cette œuvre" className="iozy-verre iozy-verre--fort flex flex-col gap-5 rounded-[28px] p-5 md:p-6">
      {consultation ? (
        <p className="font-display text-2xl font-bold text-textPrimary">
          {totalConnu ? `${work.totalCount} au catalogue` : `${work.elements.length} au catalogue`}
        </p>
      ) : (
        <>
          {/* The count is a flat block of the cover colour, in ink: the number is
              the first thing seen. The editable total and the shelving gestures,
              which have their own surfaces, sit under it. */}
          <div className="-mx-5 -mt-5 flex flex-col gap-2 rounded-t-[28px] bg-accent p-6 text-accentInk md:-mx-6 md:-mt-6 md:p-8">
            <p className="font-display text-[clamp(4.5rem,11vw,8.5rem)] leading-[0.85] font-bold tracking-[-0.06em]">
              {/* "1 / 6" is read "1 slash 6": the figures are for the eye, the phrase for the ear. */}
              <span aria-hidden="true">{totalConnu ? `${work.ownedCount} / ${work.totalCount}` : `${work.ownedCount}`}</span>
              <span className="sr-only">{phraseDuCompte(work)}</span>
            </p>
            <p className="font-display text-xl font-bold">{phraseDesManques(work)}</p>
            {work.nextRelease && (
              <p className="text-[15px] font-medium">
                <span className="font-bold">Prochaine sortie : </span>
                {phraseProchaineSortie(work.nextRelease)}
              </p>
            )}
          </div>
          {(total || miseDeCote) && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              {total}
              {miseDeCote}
            </div>
          )}
        </>
      )}
      {statut}
      {grille}
      {question}
      {!consultation && avecGeste && work.elements.some((e) => e.state !== 'OWNED') && (
        <p className="text-[13px] text-textDim">
          {work.collectorStatus === 'ONGOING'
            ? 'Les emplacements vides te manquent. Clique-en un quand tu l’as.'
            : 'Clique ce qui te manque quand tu l’as.'}
        </p>
      )}
    </section>
  )
}

/** "total inconnu", or where the total comes from; typed, changed or cleared in place. */
export function TotalOeuvre({
  total,
  provenance,
  editable,
  enCours,
  erreur,
  onEnregistrer,
}: {
  total: number | null
  provenance: string | null
  /** The work is counted in editions whose total a person may type. */
  editable: boolean
  enCours: boolean
  erreur: string | null
  /** A number, or null to clear the total. */
  onEnregistrer: (total: number | null) => Promise<unknown>
}) {
  const [saisie, setSaisie] = useState<string | null>(null)

  if (saisie !== null) {
    const valeur = Number.parseInt(saisie, 10)
    const valide = Number.isInteger(valeur) && valeur >= 1 && valeur <= 999
    return (
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!valide) return
          void onEnregistrer(valeur).then(() => setSaisie(null), () => undefined)
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          autoFocus
          value={saisie}
          onChange={(event) => setSaisie(event.target.value)}
          aria-label="Total de l’édition"
          placeholder="Total"
          className="champ w-28"
        />
        <button type="submit" disabled={!valide || enCours} className="btn-primaire">
          {enCours ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => setSaisie(null)} className="min-h-11 px-2 text-sm text-textDim">
          Annuler
        </button>
        {erreur && <span className="w-full text-sm text-dangerText">{erreur}</span>}
      </form>
    )
  }

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-textDim">
      {total === null ? <span>total inconnu</span> : provenance && <span>Total {provenance}</span>}
      {editable && (
        <>
          <button
            type="button"
            onClick={() => setSaisie(total === null ? '' : String(total))}
            className="min-h-11 font-semibold text-textPrimary underline decoration-[var(--color-vive)] underline-offset-4"
          >
            {total === null ? 'Saisir le total' : 'Modifier le total'}
          </button>
          {total !== null && (
            <button
              type="button"
              disabled={enCours}
              onClick={() => void onEnregistrer(null)}
              className="min-h-11 text-textDim underline underline-offset-4 disabled:opacity-50"
            >
              Effacer le total
            </button>
          )}
        </>
      )}
      {erreur && <span className="w-full text-sm text-dangerText">{erreur}</span>}
    </p>
  )
}

/** En cours / En pause / Abandonnée: what the collector does with this work. */
export function StatutCollection({
  statut,
  onChoisir,
  enCours,
}: {
  statut: CollectorStatus
  onChoisir: (statut: CollectorStatus) => void
  enCours: boolean
}) {
  const ordre: CollectorStatus[] = ['ONGOING', 'PAUSED', 'DROPPED']
  return (
    <div role="radiogroup" aria-label="Où j’en suis" className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold text-textDim">Où j’en suis</span>
      {ordre.map((choix) => {
        const actif = choix === statut
        return (
          <button
            key={choix}
            type="button"
            role="radio"
            aria-checked={actif}
            disabled={enCours}
            onClick={() => !actif && onChoisir(choix)}
            className={`iozy-teinte min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${
              actif ? 'bg-vive text-encreVive' : 'iozy-verre text-textPrimary'
            }`}
          >
            {LIBELLES_STATUT[choix]}
          </button>
        )
      })}
    </div>
  )
}
