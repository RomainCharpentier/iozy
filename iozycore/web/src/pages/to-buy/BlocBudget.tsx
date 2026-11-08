import { useEffect, useRef, useState, type FormEvent } from 'react'
import { etatBudget, montantSaisi } from './libelles'
import { formaterEuros } from '@/common/lib/formats'

/**
 * The optional monthly budget (lot 216): a ring in the vivid tone of the
 * cover when it is set, one line and one button when it is not. Nobody is
 * asked for a budget; a page without one just says it has none.
 *
 * The keyboard focus follows the form: into the field when it opens, back
 * to the button that opened it when it closes. A refused save keeps the
 * form open with what was typed.
 */
export function BlocBudget({
  depense,
  budget,
  enregistrement,
  onEnregistrer,
}: {
  depense: number
  budget: number | null
  enregistrement: boolean
  onEnregistrer: (montant: number | null) => Promise<unknown>
}) {
  const [edition, setEdition] = useState(false)
  const [saisie, setSaisie] = useState('')
  const champ = useRef<HTMLInputElement>(null)
  const ouvreur = useRef<HTMLButtonElement>(null)
  const rendreLeFocus = useRef(false)
  const montant = montantSaisi(saisie)

  // The block redraws when the new budget arrives ("Fixer un budget" becomes
  // "Modifier"): the button that had the focus is gone, so the effect runs
  // again and gives it to the one now shown - only when the focus fell to
  // the page, never taken from where the person moved it.
  useEffect(() => {
    if (edition) {
      champ.current?.focus()
      return
    }
    const perdu = !document.activeElement || document.activeElement === document.body
    if (rendreLeFocus.current && perdu) ouvreur.current?.focus()
  }, [edition, budget])

  function ouvrir() {
    setSaisie(budget != null ? String(budget).replace('.', ',') : '')
    setEdition(true)
  }

  function fermer() {
    rendreLeFocus.current = true
    setEdition(false)
  }

  async function soumettre(event: FormEvent) {
    event.preventDefault()
    if (montant === null) return
    try {
      await onEnregistrer(montant)
      fermer()
    } catch {
      // The page says why (toast); the form stays open with the amount typed.
    }
  }

  if (edition) {
    return (
      <form onSubmit={soumettre} className="iozy-verre flex flex-col gap-3 rounded-2xl p-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-textPrimary">
          Budget du mois (€)
          <input
            ref={champ}
            className="champ"
            inputMode="decimal"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="150"
          />
        </label>
        {saisie.trim() !== '' && montant === null && (
          <p className="text-xs text-dangerText">Un montant positif, jusqu’à 100 000 €.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primaire" disabled={montant === null || enregistrement}>
            Enregistrer
          </button>
          <button type="button" className="btn-discret" onClick={fermer}>
            Annuler
          </button>
        </div>
      </form>
    )
  }

  if (budget == null) {
    return (
      <div className="iozy-verre flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <p className="text-sm text-textDim">Pas de budget ce mois-ci.</p>
        <button ref={ouvreur} type="button" className="btn-secondaire" onClick={ouvrir}>
          Fixer un budget
        </button>
      </div>
    )
  }

  const { ligne, reste, part } = etatBudget(depense, budget)
  const pourcent = Math.round(part * 100)
  return (
    <div className="iozy-verre flex items-center gap-4 rounded-2xl p-4">
      <div
        role="img"
        aria-label={`${pourcent} % du budget de ${formaterEuros(budget)}`}
        className="iozy-teinte relative h-20 w-20 shrink-0 rounded-full"
        style={{ background: `conic-gradient(var(--color-vive) 0 ${pourcent}%, var(--color-ligneVerre) 0 100%)` }}
      >
        <span className="absolute inset-2 flex items-center justify-center rounded-full bg-surface font-display text-base font-bold text-textPrimary">
          {pourcent} %
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold text-textPrimary">Budget du mois</p>
        <p className="text-sm text-textPrimary">{ligne}</p>
        <p className="text-xs text-textDim">{reste}</p>
        <div className="-ml-3 flex flex-wrap">
          <button ref={ouvreur} type="button" className="btn-discret" onClick={ouvrir}>
            Modifier
          </button>
          <button type="button" className="btn-discret" disabled={enregistrement} onClick={() => {
              rendreLeFocus.current = true
              void onEnregistrer(null).catch(() => {})
            }}
          >
            Retirer le budget
          </button>
        </div>
      </div>
    </div>
  )
}
