/**
 * <b>A setting remembered from one visit to the next, and which survives what it reads back.</b>
 *
 * These preferences come from `localStorage`: data that the app does not
 * control: written by a previous version, truncated, edited by hand, or
 * simply refused by the browser in private browsing. Two rules follow from
 * it, and both break silently - the screen just opens on the wrong filter:
 * <ul>
 *   <li>the validation is done <b>field by field</b>: a setting added later,
 *       or a corrupted one, must not make the others fall back to their
 *       default;</li>
 *   <li>writing only replaces what is named - `definir({ tri })` must not
 *       erase the current filter.</li>
 * </ul>
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirPreferencesCollection, usePreferencesCollection } from './preferencesCollection'
import { act, renderHook } from '@testing-library/react'

const CLE = 'iozycore.preferencesCollection'

function lireBrut(): unknown {
  return JSON.parse(localStorage.getItem(CLE) ?? 'null')
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('the reading', () => {
  it('opens on "all / grouped / recent" when nothing was ever chosen', () => {
    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'tout', vue: 'groupee', tri: 'recent' })
  })

  it('reads back what was chosen', () => {
    localStorage.setItem(CLE, JSON.stringify({ filtre: 'envies', vue: 'plate', tri: 'titre' }))

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'envies', vue: 'plate', tri: 'titre' })
  })

  it('does not let a corrupted field carry the others away', () => {
    // The case of a setting renamed between two versions: "grille" no longer
    // exists, but the chosen filter and sort are still valid.
    localStorage.setItem(CLE, JSON.stringify({ filtre: 'possedes', vue: 'grille', tri: 'titre' }))

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'possedes', vue: 'groupee', tri: 'titre' })
  })

  it('survives a content that is not even JSON', () => {
    localStorage.setItem(CLE, '{ceci nest pas du json')

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'tout', vue: 'groupee', tri: 'recent' })
  })

  it('survives a valid JSON that is not an object', () => {
    localStorage.setItem(CLE, '"envies"')

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'tout' })
  })
})

describe('the writing', () => {
  it('only replaces what is named', () => {
    definirPreferencesCollection({ filtre: 'envies' })
    definirPreferencesCollection({ tri: 'titre' })

    expect(lireBrut()).toEqual({ filtre: 'envies', vue: 'groupee', tri: 'titre' })
  })

  it('updates the screens that are already open, without a reload', () => {
    // Ma collection and the view of a category share the setting: they must
    // follow each other, not each start from their own default.
    const { result } = renderHook(() => usePreferencesCollection())

    act(() => definirPreferencesCollection({ vue: 'plate' }))

    expect(result.current.vue).toBe('plate')
  })

  it('leaves the page usable when the storage is refused', () => {
    // Private browsing: `setItem` throws. The intended behavior is explicit
    // in the module - the page does not fall, it simply forgets the choice.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => usePreferencesCollection())

    expect(() => act(() => result.current.definir({ filtre: 'envies' }))).not.toThrow()
    expect(result.current.filtre).toBe('tout')
  })
})
