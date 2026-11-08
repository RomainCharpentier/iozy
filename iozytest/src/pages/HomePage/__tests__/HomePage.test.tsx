/**
 * « On joue ? » : la partie rapide ouvre le salon en un clic, avec les
 * réglages par défaut ; choisir les thèmes reste à côté.
 */
import { vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { Question } from '@/types'

const { getAll, toastError } = vi.hoisted(() => ({ getAll: vi.fn(), toastError: vi.fn() }))

vi.mock('@/api', () => ({
  questionsApi: { getAll },
  ApiError: class ApiError extends Error {},
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: toastError }) }))
vi.mock('@/utils/sounds', () => ({
  soundManager: { playClick: vi.fn(), playStart: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() },
}))

import HomePage from '@/pages/HomePage/HomePage'
import { GameProvider, useGameState } from '@/lib/game/GameContext'
import { settingsService } from '@/services/settingsService'

const q = (id: string, category: string): Question => ({
  id,
  category,
  type: 'video',
  mediaUrl: `https://youtu.be/${id}`,
  answer: id,
})

let lastState: ReturnType<typeof useGameState>['gameState'] = null

function Lobby() {
  const { gameState } = useGameState()
  lastState = gameState
  return <p>Salon ouvert</p>
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderHome() {
  return render(
    <GameProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/create" element={<Lobby />} />
          <Route path="/categories" element={<Where />} />
          <Route path="/username" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </GameProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  lastState = null
  vi.spyOn(console, 'error').mockImplementation(() => {})
  settingsService.updateSetting('username', 'Romain')
})

describe('On joue ?', () => {
  it('dit combien d’extraits la partie rapide tire', async () => {
    getAll.mockResolvedValue({
      films: Array.from({ length: 24 }, (_, i) => q(`f${i}`, 'films')),
    })
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'On joue ?' })).toBeTruthy()
    expect(
      await screen.findByText('10 extraits tirés parmi 24, tous thèmes, rien à régler.')
    ).toBeTruthy()
  })

  it('Partie rapide : un clic ouvre le salon, tous thèmes, 10 extraits, le joueur en hôte', async () => {
    getAll.mockResolvedValue({
      films: Array.from({ length: 12 }, (_, i) => q(`f${i}`, 'films')),
      animes: [q('a1', 'animes')],
    })
    renderHome()
    await screen.findByText(/parmi 13/)
    fireEvent.click(screen.getByRole('button', { name: 'Partie rapide' }))

    expect(await screen.findByText('Salon ouvert')).toBeTruthy()
    expect(lastState?.gameMode).toBe('online')
    expect(lastState?.questionCount).toBe(10)
    expect(lastState?.questions).toHaveLength(13)
    expect([...(lastState?.categories ?? [])].sort()).toEqual(['animes', 'films'])
    expect(lastState?.playerName).toBe('Romain')
  })

  it('banque vide : pas de partie rapide, l’éditeur est proposé', async () => {
    getAll.mockResolvedValue({})
    renderHome()
    expect(
      await screen.findByText(/La banque est vide : ajoute des extraits dans l’éditeur./)
    ).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Partie rapide' }) as HTMLButtonElement).disabled
    ).toBe(true)
    expect(screen.getByRole('link', { name: 'Ouvrir l’éditeur' })).toBeTruthy()
  })

  it('banque injoignable : le clic retente puis prévient, sans ouvrir de salon', async () => {
    getAll.mockRejectedValue(new Error('réseau'))
    renderHome()
    await screen.findByText('La banque de questions ne répond pas pour l’instant.')
    fireEvent.click(screen.getByRole('button', { name: 'Partie rapide' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'La banque de questions ne répond pas. Réessaie dans un instant.'
      )
    )
    expect(getAll).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Salon ouvert')).toBeNull()
  })

  it('Choisir les thèmes mène au choix des thèmes', async () => {
    getAll.mockResolvedValue({ films: [q('f', 'films')] })
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Choisir les thèmes' }))
    expect(screen.getByTestId('where').textContent).toBe('/categories')
  })
})
