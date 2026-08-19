import { useTheme } from '../../lib/theme'
import { RANK_INK_DARK, RANK_INK_LIGHT, rankColorVar } from '../../lib/tierListVisuals'
import type { Rank } from '../../types/tierList'

const SIZE_CLASSES = {
  compact: 'h-[26px] w-[26px] rounded-lg text-xs',
  default: 'h-10 w-10 rounded-xl text-base sm:h-11 sm:w-11',
  picker: 'h-[52px] w-[52px] rounded-2xl text-xl',
} as const

/** Pastille de rang - voir DS v1.1 §9 "Composants Tier" : la LETTRE porte
 * l'info, la couleur ne fait que la renforcer. 3 tailles (compact = fiche/
 * aperçu de hub, default = board, picker = sélecteur de rang). */
export function TierBadge({
  rank,
  size = 'default',
  className = '',
}: {
  rank: Rank
  size?: 'compact' | 'default' | 'picker'
  className?: string
}) {
  const { theme } = useTheme()
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-display font-bold ${SIZE_CLASSES[size]} ${className}`}
      style={{ background: rankColorVar(rank), color: theme === 'dark' ? RANK_INK_DARK : RANK_INK_LIGHT }}
    >
      {rank}
    </span>
  )
}
