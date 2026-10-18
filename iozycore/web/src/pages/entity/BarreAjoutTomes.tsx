import { Check, Loader2 } from 'lucide-react'
import { ErrorBanner } from '@/common/components/ErrorBanner'

/**
 * What goes with a selection of volumes to add: the condition of the
 * copies, their price, and the button that confirms.
 *
 * <h2>Why it only appears once something is checked</h2>
 * It was a permanent form on the old `/add/draft` screen, where
 * adding was the only purpose of the page. On the detail page, adding
 * is only one thing among others: asking for the condition and price before
 * even knowing whether there will be an add would turn the page into a form.
 *
 * <h2>One click, and nothing else</h2>
 * It asked for the condition of the copies and their price before allowing the add.
 * That is two questions too many when the user simply wants to say "I have
 * them" (user decision of 2026-08-27): the condition is stored as `NEW`, as
 * it already was the default value, and both are fixed later on
 * each copy (see OwnershipDetails) - where they describe some
 * real thing rather than a form to fill in advance.
 */
export function BarreAjoutTomes({
  nombre,
  onAjouter,
  enCours,
  attente,
  erreur,
  onToutDeselectionner,
}: {
  nombre: number
  onAjouter: () => void
  enCours: boolean
  /** The information about the work is not known yet. Adding
   *  now would create a page without a cover or author - seen
   *  live: two volumes added from a preview opened by URL, whose
   *  metadata search had not answered yet, gave a work
   *  with empty attributes. */
  attente: boolean
  erreur: string | null
  onToutDeselectionner: () => void
}) {
  if (nombre === 0) return null

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-accent/30 bg-accentTint p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-textPrimary">
          {nombre} tome{nombre > 1 ? 's' : ''} sélectionné{nombre > 1 ? 's' : ''}
        </p>
        <button type="button" onClick={onToutDeselectionner} className="text-[13px] text-textDim underline">
          Tout désélectionner
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-5">
        <button
          type="button"
          onClick={onAjouter}
          disabled={enCours || attente}
          className="btn-primaire"
        >
          {enCours ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {enCours ? 'Ajout en cours...' : `Ajouter à ma collection`}
        </button>
      </div>

      {attente && (
        <p className="text-[13px] text-textDim">
          Informations de l'œuvre en cours de chargement — encore un instant avant de pouvoir ajouter.
        </p>
      )}
      {erreur && <ErrorBanner message={erreur} />}
    </div>
  )
}
