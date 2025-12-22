import { useState, useEffect, useRef } from 'react'
import { Category, Question } from '../../types'
import { connectSocket, getSocket } from '../../utils/socket'
import { getPlayerId } from '../../utils/playerId'
import { soundManager } from '../../utils/sounds'
import { TIMING, QUESTION_COUNT } from '../../constants/timing'
import { QuestionService } from '../../services/questionService'
import { CATEGORIES } from '../../constants/categories'
import '../../styles/design-system.css'

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
  const [playerName, setPlayerName] = useState<string>(() => {
    // Utiliser le nom depuis les settings si disponible
    if (initialPlayerName) return initialPlayerName
    try {
      const settings = JSON.parse(localStorage.getItem('blindtest-settings') || '{}')
      return settings.username || ''
    } catch {
      return ''
    }
  })
  const [players, setPlayers] = useState<any[]>([])
  const [currentPlayerName, setCurrentPlayerName] = useState<string>('')
  const [timeLimit, setTimeLimit] = useState<number>(TIMING.DEFAULT_TIME_LIMIT)
  const [questionCount, setQuestionCount] = useState<number>(Math.min(QUESTION_COUNT.DEFAULT, questions.length))
  const [availableQuestionsCount, setAvailableQuestionsCount] = useState<number>(questions.length)
  const isStartingGameRef = useRef(false)

  useEffect(() => {
    const available = QuestionService.getQuestionsForCategories(categories)
    setAvailableQuestionsCount(available.length)
    const maxCount = Math.min(QUESTION_COUNT.MAX, available.length)
    setQuestionCount(prev => Math.min(prev, maxCount))
  }, [categories])

  useEffect(() => {
    if (roomCode) return
    
    let timeoutId: number | null = null
    const playerId = getPlayerId()
    
    try {
      const socket = connectSocket()

      const handleConnect = () => {
        setIsConnecting(false)
        setError(null)
        socket.emit('room:create', {
          playerId,
          playerName: playerName || 'Hôte',
          categories,
          defaultTimeLimit: timeLimit
        })
      }

      const handleConnectError = () => {
        setIsConnecting(false)
        setError('Impossible de se connecter au serveur. Assurez-vous que le serveur backend est démarré (port 3001).')
      }

      const handleRoomCreated = ({ roomCode: code, room }: { roomCode: string, room: any }) => {
        setRoomCode(code)
        setPlayers(room.players || [])
        const hostPlayer = room.players?.find((p: any) => p.isHost)
        if (hostPlayer) {
          setCurrentPlayerName(hostPlayer.name)
          setPlayerName(hostPlayer.name)
        } else {
          const defaultName = playerName || 'Hôte'
          setCurrentPlayerName(defaultName)
          setPlayerName(defaultName)
        }
        // Générer un lien vers la racine avec le paramètre room (qui redirigera vers /room/join)
        // Cela fonctionne même si l'utilisateur n'est pas sur la même route
        const link = `${window.location.origin}/?room=${code}`
        setShareLink(link)
        soundManager.playSuccess()
        setIsConnecting(false)
        setError(null)
      }

      const handleRoomState = ({ players: updatedPlayers }: { players: any[] }) => {
        setPlayers(updatedPlayers)
        const myPlayer = updatedPlayers.find((p: any) => p.id === playerId)
        if (myPlayer) {
          setCurrentPlayerName(myPlayer.name)
        }
      }

      const handleError = ({ code, message }: { code: string, message: string }) => {
        setError(`Erreur: ${message}`)
        setIsConnecting(false)
      }

      socket.on('connect', handleConnect)
      socket.on('connect_error', handleConnectError)
      socket.on('room:created', handleRoomCreated)
      socket.on('room:state', handleRoomState)
      socket.on('error', handleError)

      // Gérer la reconnexion
      socket.on('reconnect', () => {
        if (roomCode) {
          socket.emit('room:rejoin', { roomCode, playerId })
        }
      })

      timeoutId = window.setTimeout(() => {
        if (!roomCode && !error) {
          setError('Le serveur ne répond pas. Vérifiez que le serveur backend est démarré.')
          setIsConnecting(false)
        }
      }, TIMING.CONNECTION_TIMEOUT)

      return () => {
        if (timeoutId) clearTimeout(timeoutId)
        socket.off('connect', handleConnect)
        socket.off('connect_error', handleConnectError)
        socket.off('room:created', handleRoomCreated)
        socket.off('room:state', handleRoomState)
        socket.off('error', handleError)
        socket.off('reconnect')
        
        if (roomCode && !isStartingGameRef.current) {
          socket.emit('room:leave', { roomCode })
        }
      }
    } catch (err) {
      setError('Erreur lors de la connexion au serveur.')
      setIsConnecting(false)
    }
  }, [categories, playerName, timeLimit])

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
    const socket = getSocket()
    if (!socket) {
      alert('Erreur : Socket non disponible. Veuillez rafraîchir la page.')
      return
    }
    
    if (!roomCode) {
      alert('Erreur : Code de salon manquant.')
      return
    }
    
    const allQuestions = QuestionService.getQuestionsForCategories(categories)
    if (allQuestions.length === 0) {
      alert('Erreur : Aucune question disponible.')
      return
    }

    const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)
    const limitedQuestions = shuffledQuestions.slice(0, questionCount)
    const questionsWithTimer = QuestionService.applyDefaultTimeLimit(limitedQuestions, timeLimit)

    soundManager.playStart()
    isStartingGameRef.current = true
    
    if (!socket.connected) {
      alert('Erreur : Socket non connecté. Veuillez rafraîchir la page.')
      isStartingGameRef.current = false
      return
    }
    
    const handleGameStarted = () => {
      if (timeoutId) clearTimeout(timeoutId)
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      onRoomCreated(roomCode)
    }
    
    const handleError = ({ code, message }: { code: string, message: string }) => {
      if (timeoutId) clearTimeout(timeoutId)
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      alert(`Erreur : ${message}`)
      isStartingGameRef.current = false
    }
    
    const timeoutId = window.setTimeout(() => {
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      alert('Le serveur ne répond pas. Veuillez réessayer.')
      isStartingGameRef.current = false
    }, 5000)
    
    socket.on('game:start', handleGameStarted)
    socket.on('error', handleError)
    
    if (!questionsWithTimer || questionsWithTimer.length === 0) {
      alert('Erreur : Aucune question disponible après traitement.')
      isStartingGameRef.current = false
      return
    }
    
    socket.emit('game:start', {
      roomCode,
      questions: questionsWithTimer,
      defaultTimeLimit: timeLimit,
      questionCount: questionCount
    })
  }

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || { emoji: '🎵', name: categoryId }
  }

  if (!roomCode) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: 'calc(100vh - 4rem)',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Création du salon...</h2>
        {isConnecting && (
          <>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid var(--border)',
              borderTopColor: 'var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p className="text-secondary">Connexion au serveur...</p>
          </>
        )}
        {error && (
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <p style={{ color: 'var(--error)', marginBottom: 'var(--spacing-md)' }}>{error}</p>
            <p className="text-secondary" style={{ marginBottom: 'var(--spacing-md)' }}>
              Pour démarrer le serveur backend, exécutez : <code>npm run dev:server</code>
            </p>
            <button className="btn btn-secondary" onClick={onBack}>
              ← Retour
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: 'calc(100vh - 4rem)',
      maxWidth: '100%',
      margin: '0',
      width: '100%'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)',
        paddingBottom: 'var(--spacing-md)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-xs)' }}>
            Salon {roomCode}
          </h1>
          <p className="text-secondary">
            {players.find(p => p.isHost) && `👑 Host: ${players.find(p => p.isHost)?.name}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleCopyLink}
          >
            {copied ? '✓ Copié !' : '📋 Partager'}
          </button>
        </div>
      </div>

      {/* Main Layout: 2 Columns */}
      <div className="grid-2" style={{ flex: 1, alignItems: 'start' }}>
        {/* Left Column: Players */}
        <div className="card" style={{ maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
          <div className="card-header">
            <h2 className="card-title">Joueurs ({players.length})</h2>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {players.map(player => (
              <div
                key={player.id}
                className="badge"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-sm)',
                  background: player.isHost ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
                  borderColor: player.isHost ? 'var(--accent-primary)' : 'var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  {player.isHost && <span>👑</span>}
                  <span>{player.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Share Link Section */}
          <div style={{ marginTop: 'var(--spacing-lg)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--border)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Lien de partage
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <input
                type="text"
                value={shareLink}
                readOnly
                className="input"
                style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-xs)' }}
              />
            </div>
          </div>

          {/* Player Name Input */}
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              Votre nom {currentPlayerName && `(${currentPlayerName})`}
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={currentPlayerName || "Entrez votre nom"}
                maxLength={20}
                className="input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && playerName.trim()) {
                    handleSetName()
                  }
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={handleSetName}
                disabled={!playerName.trim() || playerName.trim() === currentPlayerName}
                style={{ whiteSpace: 'nowrap' }}
              >
                {currentPlayerName ? 'Modifier' : 'Valider'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <h2 className="card-title">⚙️ Configuration</h2>
          </div>

          {/* Categories */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Thèmes sélectionnés
            </label>
            <div className="grid-auto" style={{ gap: 'var(--spacing-xs)' }}>
              {categories.map(category => {
                const catInfo = getCategoryInfo(category)
                return (
                  <span key={category} className="badge badge-primary">
                    {catInfo.emoji} {catInfo.name}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Timer Slider */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              ⏱️ Timer par question: <strong>{timeLimit}s</strong>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <input
                type="range"
                min={TIMING.MIN_TIME_LIMIT}
                max={TIMING.MAX_TIME_LIMIT}
                value={timeLimit}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setTimeLimit(value)
                  soundManager.playClick()
                }}
                style={{
                  flex: 1,
                  height: '6px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  outline: 'none',
                  WebkitAppearance: 'none'
                }}
              />
              <span style={{ minWidth: '50px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
                {timeLimit}s
              </span>
            </div>
          </div>

          {/* Question Count Slider */}
          <div style={{ marginBottom: 'var(--spacing-lg)' }}>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              🎵 Nombre de questions: <strong>{questionCount}</strong>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <input
                type="range"
                min={QUESTION_COUNT.MIN}
                max={Math.min(QUESTION_COUNT.MAX, availableQuestionsCount)}
                value={questionCount}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setQuestionCount(value)
                  soundManager.playClick()
                }}
                disabled={availableQuestionsCount === 0}
                style={{
                  flex: 1,
                  height: '6px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  outline: 'none',
                  WebkitAppearance: 'none',
                  opacity: availableQuestionsCount === 0 ? 0.5 : 1
                }}
              />
              <span style={{ minWidth: '50px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
                {questionCount}
              </span>
            </div>
            <p className="text-secondary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
              {availableQuestionsCount > 0 
                ? `${availableQuestionsCount} questions disponibles`
                : 'Aucune question disponible'
              }
            </p>
          </div>

          {/* Actions */}
          <div style={{ 
            marginTop: 'auto', 
            paddingTop: 'var(--spacing-lg)', 
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 'var(--spacing-sm)',
            justifyContent: 'flex-end'
          }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                const socket = getSocket()
                if (socket && roomCode) {
                  socket.emit('room:leave', { roomCode })
                }
                onBack()
              }}
            >
              ← Retour
            </button>
            <button 
              className="btn btn-primary btn-large" 
              onClick={handleStartGame}
              disabled={!currentPlayerName || players.length === 0 || availableQuestionsCount === 0}
            >
              ▶ Démarrer la partie
            </button>
          </div>

          {/* Error Messages */}
          {(!currentPlayerName || players.length === 0 || availableQuestionsCount === 0) && (
            <div style={{ 
              marginTop: 'var(--spacing-md)', 
              padding: 'var(--spacing-sm)', 
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: '0.5rem',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--error)'
            }}>
              {!currentPlayerName && '⚠️ Vous devez définir votre nom pour démarrer'}
              {currentPlayerName && players.length === 0 && '⚠️ Attendez qu\'au moins un joueur rejoigne'}
              {currentPlayerName && players.length > 0 && availableQuestionsCount === 0 && '⚠️ Aucune question disponible'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
