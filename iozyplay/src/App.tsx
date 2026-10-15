import styles from '@/App.module.scss'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { GameProvider } from '@/lib/game/GameContext'
import { UpdateNotification } from '@/components/common/UpdateNotification'
import ErrorBoundary from '@/components/common/ErrorBoundary'

const HomePage = lazy(() => import('@/pages/HomePage/HomePage'))
const UsernamePage = lazy(() => import('@/pages/UsernamePage/UsernamePage'))
const CategorySelectorPage = lazy(() => import('@/pages/CategorySelectorPage/CategorySelectorPage'))
const GamePage = lazy(() => import('@/pages/GamePage/GamePage'))
const EditorPage = lazy(() => import('@/pages/EditorPage/EditorPage'))
const VideoImportPage = lazy(() => import('@/pages/EditorPage/VideoImportPage'))
const RoomCreatorPage = lazy(() => import('@/pages/RoomCreatorPage/RoomCreatorPage'))
const RoomJoinerPage = lazy(() => import('@/pages/RoomJoinerPage/RoomJoinerPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage/SettingsPage'))

function GameOverlay() {
  const location = useLocation()
  const isGamePage = location.pathname === '/game'

  if (!isGamePage) return null

  return (
    <div className={styles.appOverlay}>
      <div className={styles.appOverlayContent}>🎵 Devine la musique ! 🎵</div>
    </div>
  )
}

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <div className={styles.app}>
          <Toaster position="top-right" richColors closeButton />
          <UpdateNotification />
          <GameOverlay />
          <ErrorBoundary>
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
                    <div className={styles.spinner} style={{ margin: '0 auto 1rem' }} />
                    <p>Chargement...</p>
                  </div>
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/username" element={<UsernamePage />} />
                <Route path="/categories" element={<CategorySelectorPage />} />
                <Route path="/game" element={<GamePage />} />
                <Route path="/editor" element={<EditorPage />} />
                <Route path="/editor/import-video" element={<VideoImportPage />} />
                <Route path="/room/create" element={<RoomCreatorPage />} />
                <Route path="/room/join" element={<RoomJoinerPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
