import { apiRequest } from './client'
import type { CategoryInfo } from '../types'

export const categoriesApi = {
  getAll: async (): Promise<CategoryInfo[]> => {
    return apiRequest<CategoryInfo[]>('/api/categories')
  },

  create: async (category: CategoryInfo): Promise<CategoryInfo> => {
    return apiRequest<CategoryInfo>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    })
  },

  update: async (categoryId: string, updates: Partial<CategoryInfo>): Promise<CategoryInfo> => {
    return apiRequest<CategoryInfo>(`/api/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },

  delete: async (categoryId: string): Promise<void> => {
    return apiRequest<void>(`/api/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    })
  },
}
