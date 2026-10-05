import { useTheme } from '@/common/lib/theme'
import { RANK_INK_DARK, RANK_INK_LIGHT, rankColorVar } from '@/common/lib/tierListVisuals'
import type { Rank } from '@/common/types/tierList'

const SIZE_CLASSES = {
  compact: 'h-[26px] w-[26px] rounded-lg text-xs',
  default: 'h-10 w-10 rounded-xl text-base sm:h-11 sm:w-11',
  picker: 'h-[52px] w-[52px] rounded-2xl text-xl',
} as const

/** Rank pill - see DS v1.1 §9 "Tier components": the LETTER carries
 * the info, the color only reinforces it. 3 sizes (compact = detail page/
 * hub preview, default = board, picker = rank picker). */
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
