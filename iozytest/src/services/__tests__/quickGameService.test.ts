/**
 * Partie rapide : les réglages par défaut (toute la banque, tous thèmes, 10 extraits).
 */
import { vi, beforeEach } from 'vitest'
import type { Question } from '@/types'

const { getAll } = vi.hoisted(() => ({ getAll: vi.fn() }))

vi.mock('@/api', () => ({
  questionsApi: { getAll },
  ApiError: class ApiError extends Error {},
}))

import {
  QUICK_GAME_QUESTION_COUNT,
  buildQuickGame,
  categoriesOf,
  loadQuestionBank,
} from '@/services/quickGameService'

const q = (id: string, category: Question['category']): Question => ({
  id,
  category,
  type: 'video',
  mediaUrl: `https://youtu.be/${id}`,
  answer: id,
})

const identity = (questions: Question[]) => questions

describe('buildQuickGame', () => {
  it('dix extraits par défaut, quand la banque en a assez', () => {
    const bank = Array.from({ length: 30 }, (_, i) => q(`q${i}`, 'animes'))
    const setup = buildQuickGame(bank, identity)
    expect(QUICK_GAME_QUESTION_COUNT).toBe(10)
    expect(setup?.questionCount).toBe(10)
    // Tout le pool part au salon : le serveur tire lui-même les 10 extraits.
    expect(setup?.questions).toHaveLength(30)
  })

  it('borne le nombre d’extraits à la taille de la banque', () => {
    const setup = buildQuickGame([q('a', 'films'), q('b', 'films'), q('c', 'jeux')], identity)
    expect(setup?.questionCount).toBe(3)
  })

  it('prend tous les thèmes présents, multi-thèmes compris, sans doublon', () => {
    const bank = [q('a', 'films'), q('b', ['animes', 'chansons']), q('c', 'films')]
    expect(buildQuickGame(bank, identity)?.categories).toEqual(['films', 'animes', 'chansons'])
  })

  it('compte une question rangée dans deux thèmes une seule fois', () => {
    const dup = q('a', 'films')
    const setup = buildQuickGame([dup, { ...dup, category: 'series' }], identity)
    expect(setup?.questions).toHaveLength(1)
    expect(setup?.questionCount).toBe(1)
  })

  it('mélange la banque', () => {
    const bank = [q('a', 'films'), q('b', 'films')]
    const reversed = (questions: Question[]) => [...questions].reverse()
    expect(buildQuickGame(bank, reversed)?.questions.map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('rien à jouer quand la banque est vide', () => {
    expect(buildQuickGame([], identity)).toBeNull()
  })
})

describe('categoriesOf', () => {
  it('ignore les thèmes vides', () => {
    expect(categoriesOf([q('a', ''), q('b', 'jeux')])).toEqual(['jeux'])
  })
})

describe('loadQuestionBank', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('aplatit la banque par thème', async () => {
    getAll.mockResolvedValue({ films: [q('a', 'films')], jeux: [q('b', 'jeux')] })
    expect((await loadQuestionBank())?.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('null quand le serveur ne répond pas', async () => {
    getAll.mockRejectedValue(new Error('réseau'))
    expect(await loadQuestionBank()).toBeNull()
  })
})
