import { useState, useEffect, useRef } from 'react'
import type { Category, Question } from '../../services/types'
import { connectSocket, getSocket } from '../../utils/socket'
import { getPlayerId } from '../../utils/playerId'
import { soundManager } from '../../utils/sounds'
import { TIMING, QUESTION_COUNT } from '../../services/gameService'
import { QuestionService } from '../../services/questionService'
import RoomConnectingState from './ui/RoomConnectingState'
import RoomPlayersPanel from './ui/RoomPlayersPanel'
import RoomConfigPanel from './ui/RoomConfigPanel'
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
  
  // Calculer le nombre de questions disponibles immédiatement
  const initialAvailableCount = (() => {
    try {
      const available = QuestionService.getQuestionsForCategories(categories)
      const count = Array.isArray(available) ? available.length : 0
      return typeof count === 'number' && !isNaN(count) && count >= 0 ? count : 0
    } catch {
      return 0
    }
  })()
  
  const [availableQuestionsCount, setAvailableQuestionsCount] = useState<number>(initialAvailableCount)
  
  const [questionCount, setQuestionCount] = useState<number>(() => {
    // Calculer la valeur initiale basée sur availableCount
    if (initialAvailableCount === 0) return 0
    const maxCount = Math.max(QUESTION_COUNT.MIN, Math.min(QUESTION_COUNT.MAX, initialAvailableCount))
    const defaultCount = Math.max(QUESTION_COUNT.MIN, Math.min(QUESTION_COUNT.DEFAULT, maxCount))
    return defaultCount
  })
  const isStartingGameRef = useRef(false)

  useEffect(() => {
    const available = QuestionService.getQuestionsForCategories(categories)
    const availableCount = Array.isArray(available) ? available.length : 0
    
    if (isNaN(availableCount) || availableCount < 0) {
      setAvailableQuestionsCount(0)
      setQuestionCount(0)
      return
    }
    
    setAvailableQuestionsCount(availableCount)
    
    if (availableCount === 0) {
      setQuestionCount(0)
      return
    }
    
    // Calculer maxCount et defaultCount avec protection contre NaN
    const safeAvailableCount = typeof availableCount === 'number' && !isNaN(availableCount) && availableCount >= 0 ? availableCount : 0
    const maxCount = Math.max(QUESTION_COUNT.MIN, Math.min(QUESTION_COUNT.MAX, safeAvailableCount))
    const defaultCount = Math.max(QUESTION_COUNT.MIN, Math.min(QUESTION_COUNT.DEFAULT, maxCount))
    
    // Vérifications finales
    const safeMaxCount = typeof maxCount === 'number' && !isNaN(maxCount) && maxCount >= QUESTION_COUNT.MIN ? maxCount : QUESTION_COUNT.MIN
    const safeDefaultCount = typeof defaultCount === 'number' && !isNaN(defaultCount) && defaultCount >= QUESTION_COUNT.MIN ? defaultCount : QUESTION_COUNT.MIN
    
    setQuestionCount(prev => {
      // Vérifier que prev est un nombre valide
      const prevValue = typeof prev === 'number' && !isNaN(prev) && isFinite(prev) ? prev : null
      
      // Si prev est invalide, utiliser la valeur par défaut
      if (prevValue === null || prevValue < QUESTION_COUNT.MIN || prevValue === 0) {
        console.log('RoomCreator: setting questionCount to defaultCount', { prev, prevValue, safeDefaultCount, safeMaxCount, safeAvailableCount })
        return safeDefaultCount
      }
      
      // Si prev est supérieur au max, le limiter au max
      if (prevValue > safeMaxCount) {
        console.log('RoomCreator: limiting questionCount to maxCount', { prev, prevValue, safeMaxCount })
        return safeMaxCount
      }
      
      // Sinon, garder la valeur actuelle
      console.log('RoomCreator: keeping questionCount', { prev, prevValue })
      return prevValue
    })
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

      const handleRoomState = (state: any) => {
        const updatedPlayers = state.players || []
        if (Array.isArray(updatedPlayers) && updatedPlayers.length > 0) {
          setPlayers(updatedPlayers)
          const myPlayer = updatedPlayers.find((p: any) => p.id === playerId)
          if (myPlayer) {
            setCurrentPlayerName(myPlayer.name)
          }
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

  if (!roomCode) {
    return (
      <RoomConnectingState
        isConnecting={isConnecting}
        error={error}
        onBack={onBack}
      />
    )
  }

  const getStartError = (): string | null => {
    if (!currentPlayerName) return '⚠️ Vous devez définir votre nom pour démarrer'
    if (players.length === 0) return '⚠️ Attendez qu\'au moins un joueur rejoigne'
    if (availableQuestionsCount === 0) return '⚠️ Aucune question disponible'
    return null
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
        <RoomPlayersPanel
          players={players}
          shareLink={shareLink}
          playerName={playerName}
          currentPlayerName={currentPlayerName}
          onPlayerNameChange={setPlayerName}
          onSetName={handleSetName}
          onCopyLink={handleCopyLink}
          copied={copied}
        />

        <RoomConfigPanel
          categories={categories}
          timeLimit={timeLimit}
          questionCount={(() => {
            const numValue = Number(questionCount)
            // Si questionCount est un nombre valide, l'utiliser
            if (!isNaN(numValue) && isFinite(numValue) && numValue >= QUESTION_COUNT.MIN) {
              return numValue
            }
            // Sinon, passer 0 pour que RoomConfigPanel calcule la valeur par défaut
            return 0
          })()}
          availableQuestionsCount={typeof availableQuestionsCount === 'number' && !isNaN(availableQuestionsCount) ? availableQuestionsCount : 0}
          onTimeLimitChange={setTimeLimit}
          onQuestionCountChange={setQuestionCount}
          onStartGame={handleStartGame}
          onBack={() => {
            const socket = getSocket()
            if (socket && roomCode) {
              socket.emit('room:leave', { roomCode })
            }
            onBack()
          }}
          canStart={!!currentPlayerName && players.length > 0 && availableQuestionsCount > 0}
          startError={getStartError()}
        />
      </div>
    </div>
  )
}
