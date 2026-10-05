import { describe, expect, it } from 'vitest'
import { rapportDuBloc, recadrer } from './recadrage'

describe('showing a frame in close-up', () => {
  it('enlarges the photo so that the frame fills the block, and shifts it onto it', () => {
    // Without a margin to read the digits: a frame 10 % wide, 80 % tall,
    // that starts at 20 % from the left edge and 10 % from the top.
    const recadrage = recadrer({ image: 0, left: 0.2, top: 0.1, right: 0.3, bottom: 0.9 }, 0)

    expect(recadrage.largeur).toBeCloseTo(0.1)
    expect(recadrage.hauteur).toBeCloseTo(0.8)
    expect(recadrage.backgroundSize).toBe('1000.00% 125.00%')
    // 0.2 / (1 - 0.1) = 22.22 % ; 0.1 / (1 - 0.8) = 50 %
    expect(recadrage.backgroundPosition).toBe('22.22% 50.00%')
  })

  it('adds a margin without ever going outside the photo', () => {
    const recadrage = recadrer({ image: 0, left: 0.02, top: 0.9, right: 0.1, bottom: 0.98 }, 0.06)

    expect(recadrage.largeur).toBeCloseTo(0.16)
    expect(recadrage.hauteur).toBeCloseTo(0.16)
    expect(recadrage.backgroundPosition).toBe('0.00% 100.00%')
  })

  it('a frame that covers the whole photo is shown as it is', () => {
    const recadrage = recadrer({ image: 0, left: 0, top: 0, right: 1, bottom: 1 })

    expect(recadrage.backgroundSize).toBe('100.00% 100.00%')
    expect(recadrage.backgroundPosition).toBe('0.00% 0.00%')
  })

  it('gives the block the ratio of the piece of photo shown', () => {
    const recadrage = recadrer({ image: 0, left: 0.2, top: 0.1, right: 0.3, bottom: 0.9 }, 0)

    expect(rapportDuBloc(recadrage, { w: 2000, h: 1000 })).toBe('200.0 / 800.0')
    // Photo of unknown size: a 4/3 by default, rather than nothing.
    expect(rapportDuBloc(recadrage, undefined)).toBe('0.4 / 2.4')
  })
})
