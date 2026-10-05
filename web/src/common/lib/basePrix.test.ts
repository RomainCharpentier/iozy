/**
 * <b>The guardrail of the AI feature, reduced to two functions.</b>
 *
 * Data produced by a language model must NEVER be presented as real data.
 * Four screens translated this enum each in their own corner, and one of
 * them - written before the AI existed - put "(marché)" on everything that
 * was not theoretical, so on an AI estimate.
 *
 * <p>The `null` case matters as much as the other three: writing nothing is
 * better than claiming an origin that we do not know. A fallback on
 * "théorique" would be an invention.
 */
import { describe, expect, it } from 'vitest'
import { libelleBaseCourt, libelleBaseLong } from './basePrix'

describe('libelleBaseCourt', () => {
  it('names the three origins distinctly', () => {
    expect(libelleBaseCourt('OBSERVED_MARKET')).toBe('marché')
    expect(libelleBaseCourt('AI_ESTIMATED')).toBe('estimation IA')
    expect(libelleBaseCourt('THEORETICAL_ONLY')).toBe('théorique')
  })

  it('writes nothing when the origin is unknown', () => {
    expect(libelleBaseCourt(null)).toBeNull()
  })
})

describe('libelleBaseLong', () => {
  it('says of an AI estimate that it is not verified', () => {
    expect(libelleBaseLong('AI_ESTIMATED')).toBe('estimation IA, non vérifiée')
  })

  it('reserves the word "observés" for real observations', () => {
    expect(libelleBaseLong('OBSERVED_MARKET')).toBe('prix de marché observés')
    expect(libelleBaseLong('THEORETICAL_ONLY')).not.toContain('observ')
    expect(libelleBaseLong('AI_ESTIMATED')).not.toContain('observ')
  })

  it('writes nothing when the origin is unknown', () => {
    expect(libelleBaseLong(null)).toBeNull()
  })
})

describe('the two registers', () => {
  it('say the same meaning, never two different origins', () => {
    // The short one is an aside after an amount, the long one a sentence of
    // the assistant: two places, one single meaning written once.
    expect(libelleBaseLong('AI_ESTIMATED')).toContain(libelleBaseCourt('AI_ESTIMATED') as string)
    expect(libelleBaseLong('THEORETICAL_ONLY')).toContain('théorique')
  })
})
