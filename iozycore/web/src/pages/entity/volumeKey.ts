import type { VolumeCandidateDto } from '@/common/types/api'

/**
 * Stable key identifying a volume in a selection set.
 *
 * The same series can have several editions that each carry a volume
 * number 1: the key therefore combines edition AND number, never the number alone.
 *
 * <p>Lives here rather than in `VolumeSelectionGrid` because it is a pure
 * function, unrelated to rendering - and because a file that exports both a
 * component and something else makes the whole module lose hot
 * refresh.
 */
export function volumeKey(v: Pick<VolumeCandidateDto, 'edition' | 'volumeNumber'>): string {
  return `${v.edition}|${v.volumeNumber}`
}
