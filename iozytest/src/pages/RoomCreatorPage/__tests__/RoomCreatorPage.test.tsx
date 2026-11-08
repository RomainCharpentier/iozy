/**
 * Salon de l'hôte : « Retour » ramène là d'où la partie est partie
 * (partie rapide : « On joue ? », sinon le choix des thèmes).
 */
import { vi } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

vi.mock('@/pages/RoomCreatorPage/RoomCreator', () => ({
  default: ({ onBack }: { onBack: () => void }) => (
    <button type="button" onClick={onBack}>
      Retour
    </button>
  ),
}))

import RoomCreatorPage from '@/pages/RoomCreatorPage/RoomCreatorPage'
import { GameProvider, useGameState } from '@/lib/game/GameContext'

function Seed({ origin }: { origin?: 'quick' | 'themes' }) {
  const { gameState, setGameState } = useGameState()
  useEffect(() => {
    setGameState({
      categories: ['films'],
      questions: [{ id: 'q1', category: 'films', type: 'video', mediaUrl: 'x', answer: 'A' }],
      gameMode: 'online',
      players: [],
      playerName: 'Romain',
      origin,
    })
  }, [origin, setGameState])
  return gameState ? <RoomCreatorPage /> : null
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderLobby(origin?: 'quick' | 'themes') {
  render(
    <GameProvider>
      <MemoryRouter initialEntries={['/room/create']}>
        <Routes>
          <Route path="/room/create" element={<Seed origin={origin} />} />
          <Route path="/" element={<Where />} />
          <Route path="/categories" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </GameProvider>
  )
}

describe('Salon : le bouton Retour', () => {
  it('après une partie rapide, ramène à « On joue ? »', async () => {
    renderLobby('quick')
    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }))
    expect(screen.getByTestId('where').textContent).toBe('/')
  })

  it('après le choix des thèmes, ramène au choix des thèmes', async () => {
    renderLobby('themes')
    fireEvent.click(await screen.findByRole('button', { name: 'Retour' }))
    expect(screen.getByTestId('where').textContent).toBe('/categories')
  })
})
