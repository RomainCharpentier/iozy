import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { soundManager } from '../../utils/sounds'
import '../../styles/design-system.css'

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
  const navigate = useNavigate()
  const [showJoinRoom, setShowJoinRoom] = useState(false)
  const [roomCode, setRoomCode] = useState<string>('')

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      alert('Veuillez entrer un code de salon !')
      return
    }
    
    soundManager.playClick()
    navigate(`/room/join?room=${roomCode.trim().toUpperCase()}`)
  }

  if (showJoinRoom) {
    return (
      <div className="home-layout">
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="card-header">
            <h2 className="card-title">🔗 Rejoindre un salon</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                Code du salon
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                maxLength={6}
                className="input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && roomCode.trim()) {
                    handleJoinRoom()
                  }
                }}
                autoFocus
                style={{ textAlign: 'center', fontSize: 'var(--font-size-xl)', letterSpacing: '0.2em', fontWeight: 700 }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  soundManager.playClick()
                  setShowJoinRoom(false)
                  setRoomCode('')
                }}
              >
                ← Retour
              </button>
              <button 
                className="btn btn-primary" 
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
    <div className="home-layout">
      <div style={{ 
        position: 'relative',
        textAlign: 'center', 
        marginBottom: 'var(--spacing-xl)',
        paddingTop: 'var(--spacing-xl)',
        paddingLeft: 'var(--spacing-md)',
        paddingRight: 'var(--spacing-md)'
      }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            soundManager.playClick()
            navigate('/settings')
          }}
          style={{
            position: 'absolute',
            top: 'var(--spacing-xl)',
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            padding: 'var(--spacing-sm) var(--spacing-md)'
          }}
          title="Réglages"
        >
          <span>⚙️</span>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>Réglages</span>
        </button>
        <h1 style={{ 
          fontSize: 'var(--font-size-2xl)', 
          fontWeight: 700,
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 'var(--spacing-sm)'
        }}>
          🎵 No Peeking 🎵
        </h1>
        <p className="text-secondary" style={{ fontSize: 'var(--font-size-lg)' }}>
          Écoute et devine les chansons, séries TV, animes, films et jeux !
        </p>
      </div>
      
      <div className="grid-3" style={{ maxWidth: '100%', margin: '0', width: '100%', padding: '0 var(--spacing-xl)' }}>
        {/* Card Solo */}
        <div className="card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => {
          soundManager.playStart()
          onCreateGame()
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>🎮</div>
          <h3 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-sm)' }}>CRÉER</h3>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-lg)' }}>
            Créer une partie solo ou multijoueur
          </p>
          <button className="btn btn-primary btn-large" style={{ width: '100%' }}>
            Créer une partie
          </button>
        </div>

        {/* Card Rejoindre */}
        <div className="card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => {
          soundManager.playClick()
          setShowJoinRoom(true)
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>🔗</div>
          <h3 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-sm)' }}>REJOINDRE</h3>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-lg)' }}>
            Rejoins un salon avec un code
          </p>
          <button className="btn btn-secondary btn-large" style={{ width: '100%' }}>
            Rejoindre une partie
          </button>
        </div>

        {/* Card Éditeur */}
        <div className="card" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => {
          soundManager.playClick()
          onOpenEditor()
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>📝</div>
          <h3 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-sm)' }}>ÉDITEUR</h3>
          <p className="text-secondary" style={{ marginBottom: 'var(--spacing-lg)' }}>
            Ajoute et modifie les questions
          </p>
          <button className="btn btn-tertiary btn-large" style={{ width: '100%' }}>
            Ouvrir l'éditeur
          </button>
        </div>
      </div>
    </div>
  )
}
