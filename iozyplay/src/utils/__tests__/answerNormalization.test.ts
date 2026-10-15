/**
 * Comparaison des réponses (solo) : insensible aux accents, majuscules, ponctuation et
 * apostrophes typographiques
 */
import { compareAnswers, normalizeAnswer } from '@/utils/answerNormalization'

describe('normalizeAnswer / compareAnswers', () => {
  it('ignore accents et majuscules', () => {
    expect(compareAnswers('POKEMON', 'Pokémon')).toBe(true)
    expect(compareAnswers('pirates des caraibes', 'Pirates des Caraïbes')).toBe(true)
  })

  it('apostrophes typographiques et droites sont équivalentes', () => {
    expect(normalizeAnswer('L’Attaque')).toBe(normalizeAnswer("l'attaque"))
    expect(compareAnswers('o’hara', "O'Hara")).toBe(true)
  })

  it('ignore la ponctuation de fin', () => {
    expect(compareAnswers('super mario bros', 'Super Mario Bros.')).toBe(true)
  })
})
