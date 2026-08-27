import { Check, Loader2 } from 'lucide-react'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'

/**
 * Ajouter à sa collection une œuvre qui n'a PAS de tome - un jeu vidéo, un jeu
 * de société.
 *
 * <h2>Pourquoi un bloc à part de BarreAjoutTomes</h2>
 * Celle-là accompagne une sélection : elle n'apparaît qu'une fois des tomes
 * cochés, et annonce « 3 tomes sélectionnés ». Ici il n'y a rien à cocher -
 * l'œuvre est l'objet - donc rien à attendre non plus : le bouton est là dès
 * l'arrivée. Les deux posent les mêmes questions (état, prix) parce que ce
 * sont celles d'une possession, pas celles d'un tome.
 */
export function AjoutDirect({
  condition,
  onCondition,
  prix,
  onPrix,
  onAjouter,
  enCours,
  attente,
  erreur,
}: {
  condition: Condition
  onCondition: (condition: Condition) => void
  prix: string
  onPrix: (prix: string) => void
  onAjouter: () => void
  enCours: boolean
  /** Les informations de l'œuvre ne sont pas encore connues - ajouter
   *  maintenant créerait une fiche sans jaquette ni auteur (même précaution
   *  que BarreAjoutTomes, et pour la même raison constatée en direct). */
  attente: boolean
  erreur: string | null
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-accent/30 bg-accentTint p-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-textDim">État de l&apos;exemplaire</span>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => onCondition(c)} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-sm text-textDim" htmlFor="prixAjoutDirect">
          Prix d&apos;achat (optionnel)
          <input
            id="prixAjoutDirect"
            type="number"
            min={0}
            step="0.01"
            value={prix}
            onChange={(e) => onPrix(e.target.value)}
            placeholder="ex: 29.90"
            className="min-w-0 rounded-xl bg-surface px-3.5 py-2.5 text-sm text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={onAjouter}
          disabled={enCours || attente}
          title={attente ? "Les informations de l'œuvre ne sont pas encore chargées" : undefined}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-[13px] bg-accent px-5 text-sm font-semibold text-accentInk shadow-token-accent disabled:opacity-50"
        >
          {enCours ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Ajouter à ma collection
        </button>
      </div>

      {attente && (
        <p className="text-[13px] text-textDim">Chargement des informations de l&apos;œuvre...</p>
      )}
      {erreur && <ErrorBanner message={erreur} />}
    </div>
  )
}
