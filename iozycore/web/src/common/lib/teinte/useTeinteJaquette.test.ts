/**
 * <b>The app says why it shows the brand color.</b> A cover whose host
 * refuses to let its pixels be read (CORS) is not the same as a cover that
 * does not load: only the first one earns the discreet note of the footer.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTeinteJaquette } from './useTeinteJaquette'
import { TERRACOTTA } from './derivation'

/** An Image that loads when its pixels are not asked for, and fails otherwise. */
function imagesQuiRefusentCors(seChargeSansCors: boolean) {
  class FausseImage {
    crossOrigin: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_valeur: string) {
      setTimeout(() => {
        if (this.crossOrigin === null && seChargeSansCors) this.onload?.()
        else this.onerror?.()
      })
    }
  }
  vi.stubGlobal('Image', FausseImage)
}

afterEach(() => vi.unstubAllGlobals())

describe('the fallback of a cover', () => {
  it('names CORS when the image loads but its colors cannot be read', async () => {
    imagesQuiRefusentCors(true)
    const { result } = renderHook(() => useTeinteJaquette('https://hote-ferme.example/a.jpg'))

    await waitFor(() => expect(result.current.connue).toBe(true))
    expect(result.current.repli).toBe('cors')
    expect(result.current.principale).toEqual(TERRACOTTA)
  })

  it('does not blame CORS for an image that does not load at all', async () => {
    imagesQuiRefusentCors(false)
    const { result } = renderHook(() => useTeinteJaquette('https://hote-absent.example/b.jpg'))

    await waitFor(() => expect(result.current.connue).toBe(true))
    expect(result.current.repli).toBe('illisible')
  })

  it('says there is no cover when there is none', () => {
    const { result } = renderHook(() => useTeinteJaquette(null))
    expect(result.current.repli).toBe('sans-jaquette')
  })
})
