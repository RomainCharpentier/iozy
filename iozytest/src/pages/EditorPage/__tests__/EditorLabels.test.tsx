/**
 * Tests d'accessibilité de l'éditeur : chaque case de playlist porte le titre de sa vidéo,
 * et les libellés « Catégories » nomment bien le groupe de choix qu'ils annoncent
 */
import { vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Question } from '@/types'

const { getPlaylistVideos } = vi.hoisted(() => ({
  getPlaylistVideos: vi.fn(),
}))

vi.mock('@/services/categoryService', () => ({
  loadCategories: vi.fn().mockResolvedValue([{ id: 'anime', name: 'Anime', emoji: '📺' }]),
}))

vi.mock('@/services/questionService', () => ({
  QuestionService: { getAllQuestions: vi.fn(), saveQuestions: vi.fn() },
}))

vi.mock('@/utils/youtube', () => ({
  isYouTubeUrl: () => true,
  isYouTubePlaylistUrl: () => true,
  isValidUrlFormat: () => true,
  getPlaylistVideos,
  getYouTubeThumbnailFromUrl: () => null,
  extractYouTubeId: () => null,
  getYouTubeMetadata: vi.fn().mockResolvedValue(null),
  getYouTubeDuration: vi.fn().mockResolvedValue(null),
  extractYouTubeStartTime: () => null,
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

import VideoImportPage from '@/pages/EditorPage/VideoImportPage'
import QuestionEditor from '@/pages/EditorPage/QuestionEditor'

const question: Question = {
  id: 'a',
  category: 'anime',
  type: 'video',
  mediaUrl: 'https://example.com/a',
  answer: 'Réponse A',
}

describe("Libellés de l'éditeur", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('nomme chaque case de playlist avec le titre de sa vidéo', async () => {
    getPlaylistVideos.mockResolvedValue([
      {
        videoId: 'v1',
        videoUrl: 'https://example.com/v1',
        title: 'Générique A',
        thumbnailUrl: 'https://example.com/v1.jpg',
      },
      {
        videoId: 'v2',
        videoUrl: 'https://example.com/v2',
        title: 'Générique B',
        thumbnailUrl: 'https://example.com/v2.jpg',
      },
    ])
    render(
      <MemoryRouter>
        <VideoImportPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('URL YouTube'), {
      target: { value: 'https://example.com/playlist' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Charger la vidéo ou playlist' }))

    expect(await screen.findByRole('checkbox', { name: 'Importer « Générique A »' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Importer « Générique B »' })).toBeTruthy()

    const group = screen.getByRole('group', { name: 'Catégories :' })
    expect(group.querySelector('input[type="checkbox"]')).toBeTruthy()
  })

  it('relie le libellé « Catégorie » au sélecteur de catégories du formulaire', async () => {
    render(
      <MemoryRouter>
        <QuestionEditor questions={[question]} onSave={vi.fn()} onClose={vi.fn()} />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByTitle('Modifier'))

    const group = await screen.findByRole('group', { name: 'Catégorie *' })
    expect(group.querySelector('input[placeholder*="Rechercher une catégorie"]')).toBeTruthy()
  })
})
