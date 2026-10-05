import { describe, expect, it } from 'vitest'
import { preparerLesPhotos, retenirLesPhotos } from './photosAAnalyser'

function photo(nom: string, octets: number): File {
  return new File([new Uint8Array(octets)], nom, { type: 'image/jpeg' })
}

const LIMITE = 3 * 1024 * 1024

describe('what goes out to the reading', () => {
  it('lets through everything that fits in the limits, without a word', () => {
    const selection = retenirLesPhotos([photo('a.jpg', 1000), photo('b.jpg', LIMITE)])

    expect(selection.retenues.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(selection.message).toBeNull()
  })

  it('discards the photos that are too heavy and says so, in the singular and in the plural', () => {
    const une = retenirLesPhotos([photo('lourde.jpg', LIMITE + 1), photo('ok.jpg', 10)])
    expect(une.retenues.map((f) => f.name)).toEqual(['ok.jpg'])
    expect(une.message).toBe('1 photo de plus de 3 Mo a été écartée.')

    const deux = retenirLesPhotos([photo('l1.jpg', LIMITE + 1), photo('l2.jpg', LIMITE + 1)])
    expect(deux.retenues).toEqual([])
    expect(deux.message).toBe('2 photos de plus de 3 Mo ont été écartées.')
  })

  it('only keeps the first eight and says so', () => {
    const neuf = Array.from({ length: 9 }, (_, i) => photo(`p${i}.jpg`, 10))

    const selection = retenirLesPhotos(neuf)

    expect(selection.retenues).toHaveLength(8)
    expect(selection.message).toBe('seules les 8 premières sont analysées.')
  })

  it('combines both reasons in one sentence', () => {
    const fichiers = [photo('lourde.jpg', LIMITE + 1), ...Array.from({ length: 9 }, (_, i) => photo(`p${i}.jpg`, 10))]

    expect(retenirLesPhotos(fichiers).message).toBe(
      '1 photo de plus de 3 Mo a été écartée, seules les 8 premières sont analysées.',
    )
  })
})

describe('the shrinking', () => {
  it('returns the photo as it is when the browser cannot draw (jsdom here)', async () => {
    // No createImageBitmap or canvas here: the shrinking must step aside
    // without breaking, and the size rule take over.
    const selection = await preparerLesPhotos([photo('lourde.jpg', LIMITE + 1), photo('ok.jpg', 10)])

    expect(selection.retenues.map((f) => f.name)).toEqual(['ok.jpg'])
    expect(selection.message).toBe('1 photo de plus de 3 Mo a été écartée.')
  })

  it('says nothing and returns nothing without a file', async () => {
    expect(await preparerLesPhotos(null)).toEqual({ retenues: [], message: null })
    expect(await preparerLesPhotos([])).toEqual({ retenues: [], message: null })
  })
})
