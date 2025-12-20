import { useState, useEffect, useRef } from 'react'
import { Category, Question } from '../types'
import { connectSocket, getSocket, disconnectSocket } from '../utils/socket'
import { soundManager } from '../utils/sounds'

interface RoomCreatorProps {
  categories: Category[]
  questions: Question[]
  playerName: string
  onRoomCreated: (roomCode: string) => void
  onBack: () => void
}

export default function RoomCreator({
  categories,
  questions,
  playerName: initialPlayerName,
  onRoomCreated,
  onBack
}: RoomCreatorProps) {
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [shareLink, setShareLink] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(true)
  const [playerName, setPlayerName] = useState<string>(initialPlayerName || '')
  const [players, setPlayers] = useState<any[]>([])
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('')
  const isStartingGameRef = useRef(false) // Ref pour éviter de quitter le salon quand on démarre la partie

  useEffect(() => {
    let timeoutId: number | null = null
    
    try {
      const socket = connectSocket()

      socket.on('connect', () => {
        console.log('Socket connecté')
        setIsConnecting(false)
        setError(null)
        
        // Créer le salon une fois connecté (sans nom pour l'instant)
        socket.emit('create-room', {
          playerName: playerName || 'Hôte',
          categories
        })
      })

      socket.on('connect_error', (err) => {
        console.error('Erreur de connexion Socket.io:', err)
        setIsConnecting(false)
        setError('Impossible de se connecter au serveur. Assurez-vous que le serveur backend est démarré (port 3001).')
      })

      socket.on('room-created', ({ roomCode: code, room }) => {
        setRoomCode(code)
        setPlayers(room.players || [])
        // Récupérer le nom de l'hôte depuis la liste des joueurs
        const hostPlayer = room.players?.find((p: any) => p.isHost)
        if (hostPlayer) {
          console.log('👤 [RoomCreator] Hôte trouvé:', hostPlayer)
          setCurrentPlayerName(hostPlayer.name)
          setPlayerName(hostPlayer.name)
        } else {
          console.warn('⚠️ [RoomCreator] Aucun hôte trouvé dans les joueurs')
          // Si pas d'hôte trouvé, utiliser le nom par défaut ou celui saisi
          const defaultName = playerName || 'Hôte'
          setCurrentPlayerName(defaultName)
          setPlayerName(defaultName)
        }
        const link = `${window.location.origin}${window.location.pathname}?room=${code}`
        setShareLink(link)
        soundManager.playSuccess()
        setIsConnecting(false)
        setError(null)
      })

      socket.on('player-joined', ({ players: updatedPlayers }) => {
        setPlayers(updatedPlayers)
      })

      socket.on('player-left', ({ players: updatedPlayers }) => {
        setPlayers(updatedPlayers)
      })

      socket.on('player-name-updated', ({ players: updatedPlayers }) => {
        setPlayers(updatedPlayers)
        // Mettre à jour le nom actuel si c'est notre nom qui a changé
        const myPlayer = updatedPlayers.find((p: any) => p.id === socket.id)
        if (myPlayer) {
          setCurrentPlayerName(myPlayer.name)
        }
      })

      socket.on('room-error', ({ message }) => {
        setError(`Erreur: ${message}`)
        setIsConnecting(false)
      })

      // Timeout après 10 secondes
      timeoutId = window.setTimeout(() => {
        if (!roomCode && !error) {
          setError('Le serveur ne répond pas. Vérifiez que le serveur backend est démarré.')
          setIsConnecting(false)
        }
      }, 10000)

      return () => {
        console.log('🧹 [RoomCreator] Cleanup du useEffect', { roomCode, isStartingGame: isStartingGameRef.current })
        
        if (timeoutId) clearTimeout(timeoutId)
        socket.off('connect')
        socket.off('connect_error')
        socket.off('room-created')
        socket.off('room-error')
        socket.off('player-joined')
        socket.off('player-left')
        socket.off('player-name-updated')
        
        // Ne PAS quitter le salon si on démarre la partie (le composant Game en a besoin)
        if (roomCode && !isStartingGameRef.current) {
          console.log('🚪 [RoomCreator] Quitte le salon car isStartingGameRef.current=false')
          socket.emit('leave-room', { roomCode })
        } else if (roomCode && isStartingGameRef.current) {
          console.log('✅ [RoomCreator] Ne quitte PAS le salon car isStartingGameRef.current=true (partie en cours de démarrage)')
        }
        
        // Déconnecter le socket si on quitte le composant
        // Note: on ne déconnecte pas complètement car le socket peut être réutilisé
        // La déconnexion se fera automatiquement via l'événement disconnect du serveur
      }
    } catch (err) {
      console.error('Erreur lors de la connexion:', err)
      setError('Erreur lors de la connexion au serveur.')
      setIsConnecting(false)
    }
  }, [categories, roomCode])

  const handleSetName = () => {
    if (!playerName.trim() || !roomCode) return
    
    const socket = getSocket()
    if (!socket) return

    socket.emit('update-player-name', {
      roomCode,
      playerName: playerName.trim()
    })
    
    setCurrentPlayerName(playerName.trim())
    soundManager.playClick()
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      soundManager.playClick()
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erreur lors de la copie:', err)
    }
  }

  const handleStartGame = () => {
    console.log('🎮 [RoomCreator] ===== handleStartGame APPELÉ =====', { 
      roomCode, 
      questionsCount: questions.length,
      socket: !!getSocket(),
      currentPlayerName,
      playersCount: players.length,
      socketId: getSocket()?.id
    })
    
    const socket = getSocket()
    if (!socket) {
      console.error('❌ [RoomCreator] Socket non disponible')
      alert('Erreur : Socket non disponible. Veuillez rafraîchir la page.')
      return
    }
    
    if (!roomCode) {
      console.error('❌ [RoomCreator] Pas de roomCode')
      alert('Erreur : Code de salon manquant.')
      return
    }
    
    if (questions.length === 0) {
      console.error('❌ [RoomCreator] Aucune question disponible')
      alert('Erreur : Aucune question disponible.')
      return
    }

    console.log('🔊 [RoomCreator] Jouer le son de démarrage')
    soundManager.playStart()
    
    // Marquer qu'on démarre la partie pour éviter de quitter le salon dans le cleanup
    isStartingGameRef.current = true
    console.log('🚩 [RoomCreator] isStartingGameRef.current défini à true')
    
    console.log('📞 [RoomCreator] Appel de onRoomCreated avec roomCode:', roomCode)
    console.log('📞 [RoomCreator] État avant onRoomCreated:', {
      questionsCount: questions.length,
      categoriesCount: categories.length
    })
    
    // Appeler onRoomCreated AVANT pour que Game soit monté et écoute l'événement
    onRoomCreated(roomCode)
    
    console.log('⏳ [RoomCreator] onRoomCreated appelé, attente de 500ms avant start-game pour laisser le temps à Game de monter')
    
    // Délai plus long pour s'assurer que Game est monté et a ses listeners en place
    setTimeout(() => {
      console.log('📤 [RoomCreator] ===== ÉMISSION DE start-game =====', { 
        roomCode, 
        questionsCount: questions.length,
        socketId: socket.id,
        socketConnected: socket.connected
      })
      
      // Vérifier que le socket est toujours connecté et dans la room
      if (!socket.connected) {
        console.error('❌ [RoomCreator] Socket déconnecté avant start-game!')
        return
      }
      
      socket.emit('start-game', {
        roomCode,
        questions
      })
      console.log('✅ [RoomCreator] start-game émis au serveur')
    }, 500)
  }

  if (!roomCode) {
    return (
      <div className="room-creator">
        <div className="loading-state">
          <h2>Création du salon...</h2>
          {isConnecting && (
            <>
              <div className="spinner"></div>
              <p>Connexion au serveur...</p>
            </>
          )}
          {error && (
            <div className="error-message">
              <p style={{ color: 'var(--error-color)', marginTop: '1rem' }}>{error}</p>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Pour démarrer le serveur backend, exécutez : <code>npm run dev:server</code>
              </p>
              <button 
                className="back-button" 
                onClick={onBack}
                style={{ marginTop: '1rem' }}
              >
                ← Retour
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="room-creator">
      <div className="room-info-card">
        <h2>🎮 Salon créé !</h2>
        <div className="room-code-display">
          <span className="code-label">Code du salon :</span>
          <span className="room-code">{roomCode}</span>
        </div>

        <div className="share-section">
          <h3>Partager le lien</h3>
          <div className="share-link-container">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="share-link-input"
            />
            <button
              onClick={handleCopyLink}
              className={`copy-button ${copied ? 'copied' : ''}`}
            >
              {copied ? '✓ Copié !' : '📋 Copier'}
            </button>
          </div>
          <p className="share-hint">
            Partagez ce lien avec vos amis pour qu'ils rejoignent la partie
          </p>
        </div>

        <div className="name-input-section">
          <h3>Votre nom {currentPlayerName && `(${currentPlayerName})`}</h3>
          <div className="name-input-container">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={currentPlayerName || "Entrez votre nom"}
              maxLength={20}
              className="player-name-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && playerName.trim()) {
                  handleSetName()
                }
              }}
            />
            <button
              onClick={handleSetName}
              disabled={!playerName.trim() || playerName.trim() === currentPlayerName}
              className="submit-button"
            >
              {currentPlayerName ? 'Modifier' : 'Valider'}
            </button>
          </div>
          {currentPlayerName && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Vous pouvez modifier votre nom à tout moment
            </p>
          )}
        </div>

        <div className="waiting-players">
          <h3>Joueurs ({players.length})</h3>
          <div className="players-grid">
            {players.map(player => (
              <div
                key={player.id}
                className={`player-badge ${player.isHost ? 'host' : ''}`}
              >
                {player.name}
                {player.isHost && <span className="host-badge">👑</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="room-actions">
          <button className="back-button" onClick={() => {
            const socket = getSocket()
            if (socket && roomCode) {
              // Notifier le serveur qu'on quitte le salon
              socket.emit('leave-room', { roomCode })
            }
            // La déconnexion se fera automatiquement via l'événement disconnect
            onBack()
          }}>
            ← Retour
          </button>
          <button 
            className="start-button" 
            onClick={handleStartGame}
            disabled={!currentPlayerName || players.length === 0 || questions.length === 0}
          >
            Démarrer la partie →
          </button>
          {(!currentPlayerName || players.length === 0 || questions.length === 0) && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {!currentPlayerName && '⚠️ Vous devez définir votre nom pour démarrer'}
              {currentPlayerName && players.length === 0 && '⚠️ Attendez qu\'au moins un joueur rejoigne'}
              {currentPlayerName && players.length > 0 && questions.length === 0 && '⚠️ Aucune question disponible'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

