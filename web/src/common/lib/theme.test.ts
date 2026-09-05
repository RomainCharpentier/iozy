/**
 * <b>Le thème, et l'attribut qui ne doit pas rester dans le DOM.</b>
 *
 * Deux choses se jouent ici, et aucune ne se voit dans un test visuel :
 * <ul>
 *   <li>le thème stocké est appliqué <b>avant le premier rendu React</b> (appel
 *       synchrone dans `main.tsx`) - sans quoi la page clignote du thème par
 *       défaut au thème choisi ;</li>
 *   <li>passer au clair <b>retire</b> l'attribut. Lui affecter `undefined` le
 *       fixerait à la chaîne `"undefined"` : le clair fonctionnerait quand même,
 *       par accident, mais tout futur sélecteur `:root:not([data-theme])`
 *       échouerait sans raison visible.</li>
 * </ul>
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { applyStoredTheme, useTheme } from './theme'

const CLE = 'iozycore.theme'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('applyStoredTheme', () => {
  it('applique le sombre par défaut', () => {
    applyStoredTheme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('applique le thème mémorisé', () => {
    localStorage.setItem(CLE, 'light')

    applyStoredTheme()

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('ignore une valeur stockée qui n’est pas un thème', () => {
    localStorage.setItem(CLE, 'sepia')

    applyStoredTheme()

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

describe('useTheme', () => {
  it('bascule d’un thème à l’autre et le mémorise', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem(CLE)).toBe('light')
  })

  it('RETIRE l’attribut en clair, au lieu d’y écrire « undefined »', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).not.toBe('undefined')
  })

  it('repose l’attribut en revenant au sombre', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))
    act(() => result.current.setTheme('dark'))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
