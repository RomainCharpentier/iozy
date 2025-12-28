/**
 * Tests unitaires pour QuestionService
 */
import { QuestionService } from '../questionService'
import type { Question, Category } from '../types'

// Mock fetch
global.fetch = jest.fn()

describe('QuestionService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getQuestionsForCategories', () => {
    it('should filter questions by single category', async () => {
      const mockQuestions: Question[] = [
        { id: '1', category: 'chansons', type: 'video', mediaUrl: 'https://youtu.be/1', answer: 'Song 1' },
        { id: '2', category: 'films', type: 'video', mediaUrl: 'https://youtu.be/2', answer: 'Movie 1' },
        { id: '3', category: 'chansons', type: 'video', mediaUrl: 'https://youtu.be/3', answer: 'Song 2' }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chansons: [mockQuestions[0], mockQuestions[2]],
          films: [mockQuestions[1]]
        })
      })

      const result = await QuestionService.getQuestionsForCategories(['chansons'])
      expect(result).toHaveLength(2)
      expect(result.every(q => q.category === 'chansons' || (Array.isArray(q.category) && q.category.includes('chansons')))).toBe(true)
    })

    it('should filter questions by multiple categories', async () => {
      const mockQuestions: Question[] = [
        { id: '1', category: 'chansons', type: 'video', mediaUrl: 'https://youtu.be/1', answer: 'Song 1' },
        { id: '2', category: 'films', type: 'video', mediaUrl: 'https://youtu.be/2', answer: 'Movie 1' },
        { id: '3', category: ['chansons', 'films'], type: 'video', mediaUrl: 'https://youtu.be/3', answer: 'Both' }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chansons: [mockQuestions[0], mockQuestions[2]],
          films: [mockQuestions[1], mockQuestions[2]]
        })
      })

      const result = await QuestionService.getQuestionsForCategories(['chansons', 'films'])
      expect(result.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('generateId', () => {
    it('should use mediaUrl as ID for YouTube URLs', async () => {
      const url = 'https://youtu.be/abc123'
      const id = await QuestionService.generateId(url, 'chansons')
      expect(id).toBe(url)
    })

    it('should generate unique ID for non-YouTube URLs', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chansons: [] })
      })

      const url = '/media/song.mp3'
      const id = await QuestionService.generateId(url, 'chansons')
      expect(id).toMatch(/^chansons-\d+$/)
    })
  })

  describe('saveQuestions', () => {
    it('should organize questions with multiple categories correctly', async () => {
      const questions: Question[] = [
        { id: '1', category: ['chansons', 'films'], type: 'video', mediaUrl: 'https://youtu.be/1', answer: 'Both' },
        { id: '2', category: 'chansons', type: 'video', mediaUrl: 'https://youtu.be/2', answer: 'Song' }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await QuestionService.saveQuestions(questions)

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      
      expect(body.chansons).toHaveLength(2)
      expect(body.films).toHaveLength(1)
      expect(body.chansons.some((q: Question) => q.id === '1')).toBe(true)
      expect(body.films.some((q: Question) => q.id === '1')).toBe(true)
    })
  })
})




