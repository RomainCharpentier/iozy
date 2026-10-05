/**
 * <b>The theme, and the attribute that must not stay in the DOM.</b>
 *
 * Two things are at stake here, and neither shows in a visual test:
 * <ul>
 *   <li>the stored theme is applied <b>before the first React render</b>
 *       (synchronous call in `main.tsx`) - otherwise the page flashes from
 *       the default theme to the chosen theme;</li>
 *   <li>switching to light <b>removes</b> the attribute. Assigning `undefined`
 *       to it would set it to the string `"undefined"`: light would still
 *       work, by accident, but any future `:root:not([data-theme])` selector
 *       would fail for no visible reason.</li>
 * </ul>
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { applyStoredTheme, useTheme } from './theme'

const CLE = 'iozycore.theme'

beforeEach(() => {
  localStorage.clear()
  // The theme lives in a module store (see theme.ts): without this return
  // to the stored one, a test would inherit the last theme set by the
  // previous one.
  applyStoredTheme()
  delete document.documentElement.dataset.theme
})

describe('applyStoredTheme', () => {
  it('applies dark by default', () => {
    applyStoredTheme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('applies the remembered theme', () => {
    localStorage.setItem(CLE, 'light')

    applyStoredTheme()

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem(CLE, 'sepia')

    applyStoredTheme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('useTheme', () => {
  it('switches from one theme to the other and remembers it', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem(CLE)).toBe('light')
  })

  it('REMOVES the attribute in light, instead of writing "undefined" in it', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('undefined')
  })

  it('sets the attribute again when going back to dark', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))
    act(() => result.current.setTheme('dark'))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('makes everyone who reads it see the same theme', () => {
    // The header button is rendered twice (desktop bar, mobile bar): each
    // hook kept its own state, and the icon of the other bar would have shown
    // the old mode after a click - then "toggled back" to the one we had just
    // left. One single store, subscribed to by all.
    const premier = renderHook(() => useTheme())
    const second = renderHook(() => useTheme())

    act(() => premier.result.current.toggleTheme())

    expect(premier.result.current.theme).toBe('light')
    expect(second.result.current.theme).toBe('light')
  })
})
