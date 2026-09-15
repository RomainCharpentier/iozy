import { describe, expect, it } from 'vitest'
import { preparerLesPhotos, retenirLesPhotos } from './photosAAnalyser'

function photo(nom: string, octets: number): File {
  return new File([new Uint8Array(octets)], nom, { type: 'image/jpeg' })
}

const LIMITE = 3 * 1024 * 1024

describe('ce qui part à la lecture', () => {
  it('laisse passer tout ce qui tient dans les bornes, sans un mot', () => {
    const selection = retenirLesPhotos([photo('a.jpg', 1000), photo('b.jpg', LIMITE)])

    expect(selection.retenues.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(selection.message).toBeNull()
  })

  it('écarte les photos trop lourdes et le dit, au singulier comme au pluriel', () => {
    const une = retenirLesPhotos([photo('lourde.jpg', LIMITE + 1), photo('ok.jpg', 10)])
    expect(une.retenues.map((f) => f.name)).toEqual(['ok.jpg'])
    expect(une.message).toBe('1 photo de plus de 3 Mo a été écartée.')

    const deux = retenirLesPhotos([photo('l1.jpg', LIMITE + 1), photo('l2.jpg', LIMITE + 1)])
    expect(deux.retenues).toEqual([])
    expect(deux.message).toBe('2 photos de plus de 3 Mo ont été écartées.')
  })

  it('ne garde que les huit premières et le dit', () => {
    const neuf = Array.from({ length: 9 }, (_, i) => photo(`p${i}.jpg`, 10))

    const selection = retenirLesPhotos(neuf)

    expect(selection.retenues).toHaveLength(8)
    expect(selection.message).toBe('seules les 8 premières sont analysées.')
  })

  it('combine les deux raisons en une phrase', () => {
    const fichiers = [photo('lourde.jpg', LIMITE + 1), ...Array.from({ length: 9 }, (_, i) => photo(`p${i}.jpg`, 10))]

    expect(retenirLesPhotos(fichiers).message).toBe(
      '1 photo de plus de 3 Mo a été écartée, seules les 8 premières sont analysées.',
    )
  })
})

describe('la réduction', () => {
  it('rend la photo telle quelle quand le navigateur ne sait pas dessiner (ici jsdom)', async () => {
    // Pas de createImageBitmap ni de canvas ici : la réduction doit
    // s'effacer sans casser, et la règle de taille reprendre la main.
    const selection = await preparerLesPhotos([photo('lourde.jpg', LIMITE + 1), photo('ok.jpg', 10)])

    expect(selection.retenues.map((f) => f.name)).toEqual(['ok.jpg'])
    expect(selection.message).toBe('1 photo de plus de 3 Mo a été écartée.')
  })

  it('ne dit rien et ne rend rien sans fichier', async () => {
    expect(await preparerLesPhotos(null)).toEqual({ retenues: [], message: null })
    expect(await preparerLesPhotos([])).toEqual({ retenues: [], message: null })
  })
})
