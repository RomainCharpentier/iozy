import { useEffect } from 'react'
import { X } from 'lucide-react'
import { TierBadge } from './TierBadge'
import { useModalA11y } from '../../lib/useModalA11y'
import { RANKS, type Rank } from '../../types/tierList'

/**
 * Popover desktop / bottom sheet mobile - même pattern responsive déjà
 * établi (VolumeInteractionPanel, CollectionFilters). Réutilisé par le
 * board (clic sur une tuile) ET par "Classer cette œuvre" depuis la fiche
 * - un seul composant pour les deux entrées (voir §50 "Classer rapidement" :
 * même sélecteur, juste enchaîné élément par élément côté appelant).
 * <p>
 * Clavier (voir DS v1.1 §48) : une fois ouvert, les lettres S-F
 * choisissent directement le rang correspondant SI actif pour cette liste,
 * Échap ferme sans changement - en plus de la navigation Tab/Entrée
 * standard sur les boutons eux-mêmes.
 * <p>
 * En mode "Classer rapidement" (voir useQuickRank), le même composant porte
 * en plus un compteur de progression et un bouton "Passer" - jamais un
 * second sélecteur en parallèle : c'est la promesse du §50 ("même sélecteur,
 * juste enchaîné élément par élément").
 */
export function TierPicker({
  open,
  onClose,
  title,
  coverImageUrl,
  activeRanks,
  currentRank,
  onSelect,
  progress = null,
  onSkip,
}: {
  open: boolean
  onClose: () => void
  title: string
  coverImageUrl?: string | null
  activeRanks: Rank[]
  currentRank: Rank | null
  onSelect: (rank: Rank | null) => void
  /** Mode "Classer rapidement" seulement : position dans la file (1-indexée). */
  progress?: { current: number; total: number } | null
  /** Mode "Classer rapidement" seulement : laisser cette œuvre non classée et
   * passer à la suivante - distinct de Fermer, qui abandonne toute la file. */
  onSkip?: () => void
}) {
  // Escape + piège de focus + focus rendu au déclencheur - voir
  // useModalA11y (Lot 9, générique, partagé par tous les dialogs de l'app).
  const containerRef = useModalA11y<HTMLDivElement>(open, onClose)

  // Raccourcis S-F : propre à ce composant (pas une préoccupation "a11y
  // générique de dialog"), reste local. N'intercepte plus Escape lui-même -
  // déjà géré par le hook ci-dessus.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      const letter = e.key.toUpperCase()
      if (RANKS.includes(letter as Rank) && activeRanks.includes(letter as Rank)) {
        onSelect(letter as Rank)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onSelect, activeRanks])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-picker-title"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-x-auto md:top-1/2 md:right-auto md:left-1/2 md:bottom-auto md:w-[320px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-surface2"
      >
        <div className="flex items-center gap-3 border-b border-surface2 p-4">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" className="h-11 w-8 shrink-0 rounded object-cover" />
          ) : (
            <span className="h-11 w-8 shrink-0 rounded bg-surface2" />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span id="tier-picker-title" className="truncate font-display text-sm font-semibold text-textPrimary">
              {title}
            </span>
            {progress && (
              <span className="text-xs text-textDim">
                Classement rapide · {progress.current} / {progress.total}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {RANKS.filter((r) => activeRanks.includes(r)).map((rank) => (
            <button
              key={rank}
              type="button"
              onClick={() => onSelect(rank)}
              aria-pressed={currentRank === rank}
              className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-transform hover:-translate-y-0.5 ${
                currentRank === rank ? 'ring-2 ring-accent' : ''
              }`}
            >
              <TierBadge rank={rank} size="picker" />
            </button>
          ))}
        </div>
        {currentRank && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="border-t border-surface2 py-3 text-center text-sm font-semibold text-textDim hover:text-textPrimary"
          >
            Retirer le classement
          </button>
        )}
        {/* "Passer" n'existe qu'en classement rapide : hors de ce mode, ne
            rien choisir se fait déjà en fermant le sélecteur. */}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="border-t border-surface2 py-3 text-center text-sm font-semibold text-textDim hover:text-textPrimary"
          >
            Passer cette œuvre
          </button>
        )}
      </div>
    </>
  )
}
