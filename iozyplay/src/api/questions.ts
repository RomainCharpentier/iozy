import { apiRequest } from './client'
import type { Question, QuestionsData, Category } from '@/types'

export const questionsApi = {
  getAll: async (): Promise<QuestionsData> => {
    return apiRequest<QuestionsData>('/api/questions')
  },

  getByCategory: async (category: Category): Promise<Question[]> => {
    return apiRequest<Question[]>(`/api/questions/${encodeURIComponent(category)}`)
  },

  create: async (question: Question): Promise<Question> => {
    return apiRequest<Question>('/api/questions', {
      method: 'POST',
      body: JSON.stringify(question),
    })
  },

  update: async (questionId: string, question: Partial<Question>): Promise<Question> => {
    return apiRequest<Question>(`/api/questions/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: JSON.stringify(question),
    })
  },

  delete: async (questionId: string, category?: Category): Promise<void> => {
    const url = category
      ? `/api/questions/${encodeURIComponent(questionId)}?category=${encodeURIComponent(category)}`
      : `/api/questions/${encodeURIComponent(questionId)}`
    return apiRequest<void>(url, {
      method: 'DELETE',
    })
  },

  saveAll: async (questionsData: QuestionsData): Promise<void> => {
    return apiRequest<void>('/api/questions', {
      method: 'PUT',
      body: JSON.stringify(questionsData),
    })
  },
}
