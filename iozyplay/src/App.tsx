import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { GameProvider } from './lib/game/GameContext'
import HomePage from './pages/HomePage/HomePage'
import CategorySelectorPage from './pages/CategorySelectorPage/CategorySelectorPage'
import GamePage from './pages/GamePage/GamePage'
import EditorPage from './pages/EditorPage/EditorPage'
import RoomCreatorPage from './pages/RoomCreatorPage/RoomCreatorPage'
import RoomJoinerPage from './pages/RoomJoinerPage/RoomJoinerPage'
import SettingsPage from './pages/SettingsPage/SettingsPage'

function GameOverlay() {
  const location = useLocation()
  const isGamePage = location.pathname === '/game'

  if (!isGamePage) return null

  return (
    <div className="app-overlay">
      <div className="app-overlay-content">
        🎵 Devine la musique ! 🎵
      </div>
    </div>
  )
}

function App() {

  return (
    <GameProvider>
      <BrowserRouter>
        <div className="app">
          <GameOverlay />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
                border: '1px solid var(--border-color)',
              },
              success: {
                iconTheme: {
                  primary: 'var(--success-color)',
                  secondary: 'white',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--error-color)',
                  secondary: 'white',
                },
              },
            }}
          />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/categories" element={<CategorySelectorPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/room/create" element={<RoomCreatorPage />} />
            <Route path="/room/join" element={<RoomJoinerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
