import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { nomDeConsole } from '@/common/lib/consoles'
import { ErrorBanner } from '@/common/components/ErrorBanner'

/**
 * Add to one's collection a work that has NO volume - a video game, a board
 * game.
 *
 * <h2>One click, and nothing else</h2>
 * This block asked for the condition of the copy and its price before allowing
 * the add. That is two questions too many when the user simply wants to
 * say "I have it" (user decision of 2026-08-27): the condition is stored as
 * `NEW`, as it already was the default value, and both are fixed
 * later on the copy itself (see OwnershipDetails) - where they
 * describe something real rather than a form to fill in advance.
 *
 * <p>One question stays when the source lists several consoles: which one. It
 * decides where the game stands on the shelves, and no source can know it. It
 * stays optional: the game then waits under "Console à préciser". A single
 * console needs no question.
 */
export function AjoutDirect({
  onAjouter,
  enCours,
  attente,
  erreur,
  consoles = [],
}: {
  /** The console of this copy, when there is one to say. */
  onAjouter: (console?: string) => void
  enCours: boolean
  /** The information about the work is not known yet - adding
   *  now would create a page without a cover or author (seen
   *  live on a preview opened by URL). */
  attente: boolean
  erreur: string | null
  /** The consoles the source knows for this work. */
  consoles?: string[]
}) {
  const [choisie, setChoisie] = useState<string | null>(null)
  const uneSeule = consoles.length === 1 ? consoles[0] : undefined
  return (
    <div className="flex flex-col gap-3">
      {consoles.length > 1 && (
        <div role="radiogroup" aria-label="Sur quelle console ?" className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-textPrimary">Sur quelle console ?</span>
          <div className="flex flex-wrap gap-2">
            {consoles.map((console) => (
              <button
                key={console}
                type="button"
                role="radio"
                aria-checked={choisie === console}
                onClick={() => setChoisie(choisie === console ? null : console)}
                className={`min-h-11 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                  choisie === console
                    ? 'border-transparent bg-accentTint text-accentText'
                    : 'border-line bg-surface text-textDim hover:bg-rowHover'
                }`}
              >
                {nomDeConsole(console)}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => onAjouter(choisie ?? uneSeule)}
        disabled={enCours || attente}
        title={attente ? "Les informations de l'œuvre ne sont pas encore chargées" : undefined}
        className="btn-primaire w-fit"
      >
        {enCours ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        Ajouter à ma collection
      </button>

      {attente && <p className="text-[13px] text-textDim">Chargement des informations de l&apos;œuvre...</p>}
      {erreur && <ErrorBanner message={erreur} />}
    </div>
  )
}
