/**
 * Tests du service de questions : aucune perte de données lors de la sauvegarde
 */
import { vi, beforeEach } from 'vitest'
import type { Question } from '@/types'

const { getAll, saveAll } = vi.hoisted(() => ({ getAll: vi.fn(), saveAll: vi.fn() }))

vi.mock('@/api', () => ({
  questionsApi: { getAll, saveAll },
  ApiError: class ApiError extends Error {},
}))

import { QuestionService } from '@/services/questionService'

const q = (id: string, category: Question['category']): Question => ({
  id,
  category,
  type: 'video',
  mediaUrl: `https://youtu.be/${id}`,
  answer: id,
})

describe('QuestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('saveQuestions', () => {
    it('conserve les catégories personnalisées', async () => {
      await QuestionService.saveQuestions([q('a', 'chansons'), q('b', 'ma-categorie')])
      expect(saveAll).toHaveBeenCalledWith({
        chansons: [q('a', 'chansons')],
        'ma-categorie': [q('b', 'ma-categorie')],
      })
    })

    it('range une question multi-catégories dans chacune, sans doublon', async () => {
      const multi = q('a', ['films', 'perso'])
      await QuestionService.saveQuestions([multi, multi])
      expect(saveAll).toHaveBeenCalledWith({ films: [multi], perso: [multi] })
    })
  })

  describe('loadQuestions', () => {
    it('propage une erreur de chargement au lieu de renvoyer des données vides', async () => {
      getAll.mockRejectedValue(new Error('Failed to fetch'))
      await expect(QuestionService.loadQuestions()).rejects.toThrow('Failed to fetch')
      await expect(QuestionService.getAllQuestions()).rejects.toThrow('Failed to fetch')
    })

    it('getQuestionsForCategories renvoie [] en cas d’échec (lecture seule)', async () => {
      getAll.mockRejectedValue(new Error('Failed to fetch'))
      await expect(QuestionService.getQuestionsForCategories(['films'])).resolves.toEqual([])
    })
  })

  describe('tirage des questions', () => {
    const ids = (questions: Question[]) => questions.map((x) => x.id)

    it('getQuestionsForCategories déduplique une question présente dans plusieurs catégories', async () => {
      const multi = q('multi', ['animes', 'jeux'])
      getAll.mockResolvedValue({ animes: [multi, q('a', 'animes')], jeux: [multi, q('b', 'jeux')] })
      const result = await QuestionService.getQuestionsForCategories(['animes', 'jeux'])
      expect(ids(result).sort()).toEqual(['a', 'b', 'multi'])
    })

    it('dedupeQuestions : même id ou même mediaUrl = doublon', () => {
      const a = q('a', 'animes')
      const sameUrl = { ...q('autre', 'jeux'), mediaUrl: a.mediaUrl }
      expect(QuestionService.dedupeQuestions([a, q('a', 'jeux'), sameUrl, q('b', 'jeux')])).toEqual(
        [a, q('b', 'jeux')]
      )
    })

    it('shuffleQuestions ne mute pas l’entrée et conserve les questions', () => {
      const input = Array.from({ length: 10 }, (_, i) => q(`q${i}`, 'animes'))
      const copy = [...input]
      const result = QuestionService.shuffleQuestions(input)
      expect(input).toEqual(copy)
      expect(result).not.toBe(input)
      expect(ids(result).sort()).toEqual(ids(copy).sort())
    })

    it('shuffleQuestions : chaque question peut sortir en premier', () => {
      const input = Array.from({ length: 14 }, (_, i) => q(`q${i}`, 'animes'))
      const firsts = new Set<string | undefined>()
      for (let i = 0; i < 2000; i++) firsts.add(QuestionService.shuffleQuestions(input)[0].id)
      expect(firsts.size).toBe(14)
    })

    it('buildQuestionPool : dédupliqué, mélangé, borné à POOL_MAX', () => {
      const many = Array.from({ length: 600 }, (_, i) => q(`q${i}`, 'animes'))
      const pool = QuestionService.buildQuestionPool([...many, ...many])
      expect(pool).toHaveLength(500)
      expect(new Set(ids(pool)).size).toBe(500)
    })
  })
})
