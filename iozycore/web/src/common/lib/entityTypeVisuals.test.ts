/**
 * <b>The visual identity of a universe — and why these lists are closed.</b>
 *
 * A universe color is not decorative: it is also used as TEXT (the "Tout
 * voir" of a rail, the title of a category page). A shade chosen by eye would
 * be unreadable in every other theme, which Batch 12 had to fix. Hence a
 * closed palette, icons that are imported components, and aspect classes
 * written in full - a class built dynamically would simply not exist in the
 * produced CSS.
 *
 * <p>The rule that breaks silently: an <b>unknown</b> key (palette extended
 * elsewhere, data entered by hand, type imported from another instance) must
 * not break anything or blank anything out - it falls back on the base
 * visual.
 */
import { describe, expect, it } from 'vitest'
import {
  UNIVERSE_ASPECTS,
  UNIVERSE_ICONS,
  UNIVERSE_PALETTE,
  colorVarFor,
  getEntityTypeVisual,
} from './entityTypeVisuals'
import { typeDeCollection } from '@/test/fixtures'

describe('the shipped universes', () => {
  it('each carry their color and their cover format', () => {
    expect(getEntityTypeVisual('MANGA').aspectClassName).toBe('aspect-[2/3]')
    expect(getEntityTypeVisual('VIDEO_GAME').aspectClassName).toBe('aspect-[3/4]')
    expect(getEntityTypeVisual('BOARD_GAME').aspectClassName).toBe('aspect-square')
  })

  it('do not share the same color', () => {
    const couleurs = ['MANGA', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK'].map((c) => getEntityTypeVisual(c).color)

    expect(new Set(couleurs).size).toBe(4)
  })

  it('delegate their color to a CSS token, never to a hard-coded value', () => {
    // This is what lets the shade stay the same in both themes while only
    // the brightness adapts.
    for (const code of ['MANGA', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK']) {
      expect(getEntityTypeVisual(code).color).toMatch(/^var\(--color-/)
    }
  })
})

describe('a type created by the user', () => {
  it('sees their choice win, including over a shipped universe', () => {
    const manga = { ...typeDeCollection('MANGA'), colorKey: 'cyan', aspectKey: 'carre' }

    const visuel = getEntityTypeVisual(manga)

    expect(visuel.color).toBe(colorVarFor('cyan'))
    expect(visuel.aspectClassName).toBe('aspect-square')
  })

  it('keeps the base visual for what they did not choose', () => {
    const manga = { ...typeDeCollection('MANGA'), colorKey: 'cyan' }

    expect(getEntityTypeVisual(manga).aspectClassName).toBe('aspect-[2/3]')
  })

  it('falls back on the fallback when a key is unknown, without breaking anything', () => {
    const exotique = { ...typeDeCollection('VINYL'), colorKey: 'fuchsia', iconKey: 'licorne', aspectKey: 'triangle' }

    const visuel = getEntityTypeVisual(exotique)

    expect(visuel.color).toBe('var(--color-accent)')
    expect(visuel.aspectClassName).toBe('aspect-[2/3]')
    expect(visuel.icon).toBeTypeOf('object')
  })

  it('has a visual even without any type at hand', () => {
    expect(getEntityTypeVisual(undefined).color).toBe('var(--color-accent)')
  })
})

describe('the lists offered as a choice', () => {
  it('only offer keys that the rendering knows how to translate', () => {
    for (const { key } of UNIVERSE_PALETTE) {
      expect(colorVarFor(key)).not.toBe('var(--color-accent)')
    }
  })

  it('have no duplicate key', () => {
    expect(new Set(UNIVERSE_PALETTE.map((c) => c.key)).size).toBe(UNIVERSE_PALETTE.length)
    expect(new Set(UNIVERSE_ICONS.map((i) => i.key)).size).toBe(UNIVERSE_ICONS.length)
    expect(new Set(UNIVERSE_ASPECTS.map((a) => a.key)).size).toBe(UNIVERSE_ASPECTS.length)
  })

  it('only write complete aspect classes, never built ones', () => {
    // A class assembled at runtime (`aspect-[${ratio}]`) is not extracted by
    // Tailwind: it would not exist in the produced CSS.
    for (const { className } of UNIVERSE_ASPECTS) {
      expect(className).toMatch(/^aspect-(square|\[[\d/]+\])$/)
    }
  })
})
