import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { GameProvider } from './lib/game/GameContext'
import { UpdateNotification } from './components/common/UpdateNotification'

// Lazy loading des pages pour améliorer les performances
const HomePage = lazy(() => import('./pages/HomePage/HomePage'))
const CategorySelectorPage = lazy(() => import('./pages/CategorySelectorPage/CategorySelectorPage'))
const GamePage = lazy(() => import('./pages/GamePage/GamePage'))
const EditorPage = lazy(() => import('./pages/EditorPage/EditorPage'))
const RoomCreatorPage = lazy(() => import('./pages/RoomCreatorPage/RoomCreatorPage'))
const RoomJoinerPage = lazy(() => import('./pages/RoomJoinerPage/RoomJoinerPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage/SettingsPage'))

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
          <UpdateNotification />
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
          <Suspense fallback={
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '100vh',
              color: 'var(--color-text-primary)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                <p>Chargement...</p>
              </div>
            </div>
          }>
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
          </Suspense>
        </div>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
