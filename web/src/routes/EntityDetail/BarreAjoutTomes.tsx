import { Check, Loader2 } from 'lucide-react'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'

/**
 * Ce qui accompagne une sélection de tomes à ajouter : l'état des
 * exemplaires, leur prix, et le bouton qui valide.
 *
 * <h2>Pourquoi elle n'apparaît qu'une fois quelque chose de coché</h2>
 * C'était un formulaire permanent sur l'ancien écran `/add/draft`, où
 * l'ajout était la seule raison d'être de la page. Sur la fiche, ajouter
 * n'est qu'une chose parmi d'autres : demander l'état et le prix avant
 * même de savoir s'il y aura un ajout ferait de la fiche un formulaire.
 *
 * <h2>Un état et un prix pour tout le lot</h2>
 * Volontairement : on coche presque toujours des tomes achetés ensemble.
 * Chaque exemplaire garde ensuite son propre état et son propre prix,
 * corrigeables un par un depuis le panneau du tome (voir OwnershipDetails) -
 * c'est la saisie qui est groupée, jamais la donnée.
 */
export function BarreAjoutTomes({
  nombre,
  condition,
  onCondition,
  prix,
  onPrix,
  onAjouter,
  enCours,
  erreur,
  onToutDeselectionner,
}: {
  nombre: number
  condition: Condition
  onCondition: (condition: Condition) => void
  prix: string
  onPrix: (prix: string) => void
  onAjouter: () => void
  enCours: boolean
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
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-textDim">État</span>
          <div className="flex gap-2">
            {CONDITIONS.map((c) => (
              <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => onCondition(c)} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] text-textDim" htmlFor="prix-ajout">
            Prix d'achat (optionnel)
          </label>
          <input
            id="prix-ajout"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={prix}
            onChange={(e) => onPrix(e.target.value)}
            placeholder="ex: 6.90"
            className="w-32 rounded-xl border border-fieldBorder bg-surface px-3 py-2.5 text-sm text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onAjouter}
          disabled={enCours}
          className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-accent px-5 text-sm font-semibold text-accentInk shadow-token-accent transition-transform hover:-translate-y-px disabled:opacity-50"
        >
          {enCours ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {enCours ? 'Ajout en cours...' : `Ajouter à ma collection`}
        </button>
      </div>

      {erreur && <ErrorBanner message={erreur} />}
    </div>
  )
}
