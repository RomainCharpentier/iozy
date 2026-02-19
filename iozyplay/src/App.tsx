import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { GameProvider } from '@/lib/game/GameContext'
import { QuestionService } from '@/services/questionService'

const HomePage = lazy(() => import('@/pages/HomePage/HomePage'))
const CategorySelectorPage = lazy(() => import('@/pages/CategorySelectorPage/CategorySelectorPage'))
const GamePage = lazy(() => import('@/pages/GamePage/GamePage'))
const EditorPage = lazy(() => import('@/pages/EditorPage/EditorPage'))
const RoomCreatorPage = lazy(() => import('@/pages/RoomCreatorPage/RoomCreatorPage'))
const RoomJoinerPage = lazy(() => import('@/pages/RoomJoinerPage/RoomJoinerPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage/SettingsPage'))

function GameOverlay() {
  const location = useLocation()
  const isGamePage = location.pathname === '/game'

  if (!isGamePage) return null

  return (
    <div className="app-overlay">
      <div className="app-overlay-content">🎵 Devine la musique ! 🎵</div>
    </div>
  )
}

function App() {
  useEffect(() => {
    QuestionService.loadQuestions()
  }, [])

  return (
    <GameProvider>
      <BrowserRouter>
        <div className="app">
          <Toaster position="top-right" richColors closeButton />
          <GameOverlay />
          <Suspense
            fallback={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '100vh',
                  color: 'var(--text-color)',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                  <p>Chargement...</p>
                </div>
              </div>
            }
          >
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
