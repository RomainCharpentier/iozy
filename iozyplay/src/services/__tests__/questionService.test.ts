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
})
