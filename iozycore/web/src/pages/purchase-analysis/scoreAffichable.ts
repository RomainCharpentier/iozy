/**
 * The score of an analysis, or nothing when it is known to be false.
 *
 * <h2>Why some old analyses say 50/100</h2>
 * Until the fix of 2026-08-28 (VerdictScorer.effectiveWeight), a collector
 * profile saved with an empty weights map silenced all ten factors: every
 * listing scored exactly 50/100, whatever its factors said. The analyses are
 * frozen states, so the ones saved before that day still carry this 50.
 * Recomputing it would need what the engine knew that day (the condition
 * weight of the profile, the lot shape), which the history does not keep: the
 * score is hidden instead, and the screen says why. Never a fake 50.
 */
export const CORRECTION_DU_SCORE = Date.parse('2026-08-28T08:31:01Z')

export const NOTE_SCORE_INDISPONIBLE = 'score indisponible pour cette ancienne analyse'

/** The score to show, or null for a flat 50 saved before the fix. */
export function scoreAffichable(score: number, dateIso: string): number | null {
  const date = Date.parse(dateIso)
  if (score === 50 && !Number.isNaN(date) && date < CORRECTION_DU_SCORE) return null
  return score
}
