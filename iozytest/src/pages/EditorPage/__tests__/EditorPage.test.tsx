/**
 * Tests de l'éditeur : pas de sauvegarde sans modification, ni après un chargement en échec
 */
import { vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Question } from '@/types'

const { getAllQuestions, saveQuestions, toastError } = vi.hoisted(() => ({
  getAllQuestions: vi.fn(),
  saveQuestions: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/services/questionService', () => ({
  QuestionService: { getAllQuestions, saveQuestions },
}))

vi.mock('@/services/categoryService', () => ({
  loadCategories: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/utils/youtube', () => ({
  isYouTubeUrl: () => false,
  isValidUrlFormat: () => true,
  getYouTubeThumbnailFromUrl: () => null,
  extractYouTubeId: () => null,
  getYouTubeMetadata: vi.fn().mockResolvedValue(null),
  extractYouTubeStartTime: () => null,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: toastError, success: vi.fn() }),
}))

import EditorPage from '@/pages/EditorPage/EditorPage'

const question: Question = {
  id: 'a',
  category: 'ma-categorie',
  type: 'video',
  mediaUrl: 'https://example.com/a',
  answer: 'Réponse A',
}

const renderEditor = () =>
  render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>
  )

describe('EditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("ne sauvegarde rien à l'ouverture sans modification", async () => {
    getAllQuestions.mockResolvedValue([question])
    renderEditor()

    expect(await screen.findByText('Réponse A')).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(saveQuestions).not.toHaveBeenCalled()
  })

  it("bloque l'édition et ne sauvegarde jamais si le chargement échoue", async () => {
    getAllQuestions.mockRejectedValue(new Error('Failed to fetch'))
    renderEditor()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(toastError).toHaveBeenCalled()
    expect(screen.queryByText('Liste des questions')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(saveQuestions).not.toHaveBeenCalled()
  })
})
