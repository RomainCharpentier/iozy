import { useState, type FormEvent } from 'react'
import { etatBudget } from './libelles'
import { formaterEuros } from '@/common/lib/formats'

/**
 * The optional monthly budget (lot 216): a ring in the vivid tone of the
 * cover when it is set, one line and one button when it is not. Nobody is
 * asked for a budget; a page without one just says it has none.
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
  onEnregistrer: (montant: number | null) => void
}) {
  const [edition, setEdition] = useState(false)
  const [saisie, setSaisie] = useState('')
  const montant = Number(saisie.replace(',', '.').replace(/\s/g, ''))
  const valide = saisie.trim() !== '' && Number.isFinite(montant) && montant > 0 && montant <= 100000

  function ouvrir() {
    setSaisie(budget != null ? String(budget).replace('.', ',') : '')
    setEdition(true)
  }

  function soumettre(event: FormEvent) {
    event.preventDefault()
    if (!valide) return
    onEnregistrer(Math.round(montant * 100) / 100)
    setEdition(false)
  }

  if (edition) {
    return (
      <form onSubmit={soumettre} className="iozy-verre flex flex-col gap-3 rounded-2xl p-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-textPrimary">
          Budget du mois (€)
          <input
            className="champ"
            inputMode="decimal"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            data-modal-initial-focus
            placeholder="150"
          />
        </label>
        {saisie.trim() !== '' && !valide && (
          <p className="text-xs text-dangerText">Un montant positif, jusqu’à 100 000 €.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primaire" disabled={!valide || enregistrement}>
            Enregistrer
          </button>
          <button type="button" className="btn-discret" onClick={() => setEdition(false)}>
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
        <button type="button" className="btn-secondaire" onClick={ouvrir}>
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
          <button type="button" className="btn-discret" onClick={ouvrir}>
            Modifier
          </button>
          <button type="button" className="btn-discret" disabled={enregistrement} onClick={() => onEnregistrer(null)}>
            Retirer le budget
          </button>
        </div>
      </div>
    </div>
  )
}
