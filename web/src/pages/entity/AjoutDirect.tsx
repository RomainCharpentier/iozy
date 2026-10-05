import { Check, Loader2 } from 'lucide-react'
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
 */
export function AjoutDirect({
  onAjouter,
  enCours,
  attente,
  erreur,
}: {
  onAjouter: () => void
  enCours: boolean
  /** The information about the work is not known yet - adding
   *  now would create a page without a cover or author (seen
   *  live on a preview opened by URL). */
  attente: boolean
  erreur: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onAjouter}
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
