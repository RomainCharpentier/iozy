import { useState } from 'react'
import { soundManager } from '../utils/sounds'

interface HomeMenuProps {
  onCreateGame: () => void
  onJoinRoom: () => void
  onOpenEditor: () => void
}

export default function HomeMenu({
  onCreateGame,
  onJoinRoom,
  onOpenEditor
}: HomeMenuProps) {
  const [showJoinRoom, setShowJoinRoom] = useState(false)
  const [roomCode, setRoomCode] = useState<string>('')

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      alert('Veuillez entrer un code de salon !')
      return
    }
    
    soundManager.playClick()
    // Rediriger vers le salon avec le code dans l'URL
    window.location.href = `${window.location.pathname}?room=${roomCode.trim().toUpperCase()}`
  }

  if (showJoinRoom) {
    return (
      <div className="home-menu">
        <div className="menu-card">
          <h2>🔗 Rejoindre un salon</h2>
          
          <div className="join-room-form">
            <label>
              Code du salon
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                className="room-code-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && roomCode.trim()) {
                    handleJoinRoom()
                  }
                }}
                autoFocus
              />
            </label>
            
            <div className="menu-actions">
              <button 
                className="menu-button secondary" 
                onClick={() => {
                  soundManager.playClick()
                  setShowJoinRoom(false)
                  setRoomCode('')
                }}
              >
                ← Retour
              </button>
              <button 
                className="menu-button primary" 
                onClick={handleJoinRoom}
                disabled={!roomCode.trim()}
              >
                Rejoindre →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-menu">
      <div className="menu-card">
        <h1 className="app-title">🎵 No Peeking 🎵</h1>
        <p className="subtitle">Écoute et devine les chansons, séries TV, animes, films et jeux !</p>
        
        <div className="menu-options">
          <button
            className="menu-button primary large"
            onClick={() => {
              soundManager.playStart()
              onCreateGame()
            }}
          >
            🎮 Créer une partie
          </button>
          
          <button
            className="menu-button secondary large"
            onClick={() => {
              soundManager.playClick()
              setShowJoinRoom(true)
            }}
          >
            🔗 Rejoindre une partie
          </button>
          
          <button
            className="menu-button tertiary large"
            onClick={() => {
              soundManager.playClick()
              onOpenEditor()
            }}
          >
            📝 Éditeur de questions
          </button>
        </div>
      </div>
    </div>
  )
}

