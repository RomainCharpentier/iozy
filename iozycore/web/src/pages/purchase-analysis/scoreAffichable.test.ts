import { describe, expect, it } from 'vitest'
import { scoreAffichable } from './scoreAffichable'

describe('the score of an analysis', () => {
  it('hides the flat 50 of an analysis saved before the fix of the weights', () => {
    expect(scoreAffichable(50, '2026-08-20T10:00:00Z')).toBeNull()
  })

  it('keeps any other score, and a 50 computed after the fix', () => {
    expect(scoreAffichable(62, '2026-08-20T10:00:00Z')).toBe(62)
    expect(scoreAffichable(50, '2026-09-02T10:00:00Z')).toBe(50)
  })
})
