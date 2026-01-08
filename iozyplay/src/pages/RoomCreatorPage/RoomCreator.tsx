import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import type { Category, Question } from '../../types'
import { connectSocket, getSocket, disconnectSocketIfConnected } from '../../utils/socket'
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
  gameMode?: 'solo' | 'online'
  onRoomCreated: (roomCode: string, questions?: Question[]) => void
  onBack: () => void
}

export default function RoomCreator({
  categories,
  questions,
  playerName: initialPlayerName,
  gameMode = 'online',
  onRoomCreated,
  onBack
}: RoomCreatorProps) {
  const isSoloMode = gameMode === 'solo'
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

  const [availableQuestionsCount, setAvailableQuestionsCount] = useState<number>(0)
  const [questionCount, setQuestionCount] = useState<number>(QUESTION_COUNT.MIN)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const isStartingGameRef = useRef(false)

  useEffect(() => {
    if (isSoloMode) {
      setIsConnecting(false)
      setCurrentPlayerName(initialPlayerName || 'Joueur')
      setPlayerName(initialPlayerName || 'Joueur')
      setPlayers([{ id: 'solo', name: initialPlayerName || 'Joueur', score: 0, isHost: true }])
      disconnectSocketIfConnected()
    }
  }, [isSoloMode, initialPlayerName])

  // Charger le nombre de questions disponibles lorsque les catégories changent
  useEffect(() => {
    const loadAvailableCount = async () => {
      try {
        const available = await QuestionService.getQuestionsForCategories(categories)
        const availableCount = Array.isArray(available) ? available.length : 0

        if (isNaN(availableCount) || availableCount < 0) {
          setAvailableQuestionsCount(0)
          setQuestionCount(QUESTION_COUNT.MIN)
          return
        }

        setAvailableQuestionsCount(availableCount)

        if (availableCount === 0) {
          setQuestionCount(0)
          return
        }

        // Calculer maxCount et defaultCount
        const maxCount = Math.max(QUESTION_COUNT.MIN, Math.min(QUESTION_COUNT.MAX, availableCount))
        const defaultCount = Math.max(QUESTION_COUNT.MIN, Math.min(QUESTION_COUNT.DEFAULT, maxCount))

        setQuestionCount(prev => {
          // Vérifier que prev est un nombre valide
          const prevValue = typeof prev === 'number' && !isNaN(prev) && isFinite(prev) && prev >= QUESTION_COUNT.MIN ? prev : null

          // Si prev est invalide ou 0, utiliser la valeur par défaut
          if (prevValue === null || prevValue === 0) {
            return defaultCount
          }

          // Si prev est supérieur au max, le limiter au max
          if (prevValue > maxCount) {
            return maxCount
          }

          // Sinon, garder la valeur actuelle
          return prevValue
        })
      } catch (error) {
        console.error('Error loading available questions count:', error)
        setAvailableQuestionsCount(0)
        setQuestionCount(QUESTION_COUNT.MIN)
      }
    }

    loadAvailableCount()
  }, [categories])

  useEffect(() => {
    if (isSoloMode || roomCode) return

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

  const handleStartGame = async () => {
    if (isStartingGame) return
    
    setIsStartingGame(true)
    isStartingGameRef.current = true
    
    try {
      // En mode solo, démarrer directement sans socket
      if (isSoloMode) {
        const allQuestions = await QuestionService.getQuestionsForCategories(categories)
        if (allQuestions.length === 0) {
          toast.error('Erreur : Aucune question disponible.', {
            icon: '❌',
          })
          setIsStartingGame(false)
          isStartingGameRef.current = false
          return
        }

        const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)
        const limitedQuestions = shuffledQuestions.slice(0, questionCount)
        const questionsWithTimer = QuestionService.applyDefaultTimeLimit(limitedQuestions, timeLimit)

        if (!questionsWithTimer || questionsWithTimer.length === 0) {
          toast.error('Erreur : Aucune question disponible après traitement.', {
            icon: '❌',
          })
        return
      }

      soundManager.playStart()
      onRoomCreated('SOLO', questionsWithTimer)
      setIsStartingGame(false)
      isStartingGameRef.current = false
      return
    }

    // Mode multijoueur : utiliser le socket
    const socket = getSocket()
    if (!socket) {
      toast.error('Erreur : Socket non disponible. Veuillez rafraîchir la page.', {
        icon: '⚠️',
      })
      return
    }

    if (!roomCode) {
      toast.error('Erreur : Code de salon manquant.', {
        icon: '⚠️',
      })
      return
    }

    const allQuestions = await QuestionService.getQuestionsForCategories(categories)
    if (allQuestions.length === 0) {
      toast.error('Erreur : Aucune question disponible.', {
        icon: '❌',
      })
      return
    }

    const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)
    const limitedQuestions = shuffledQuestions.slice(0, questionCount)
    const questionsWithTimer = QuestionService.applyDefaultTimeLimit(limitedQuestions, timeLimit)

    soundManager.playStart()
    isStartingGameRef.current = true

      if (!socket.connected) {
      toast.error('Erreur : Socket non connecté. Veuillez rafraîchir la page.', {
        icon: '⚠️',
      })
      setIsStartingGame(false)
      isStartingGameRef.current = false
      return
    }

    let timeoutId: number | null = null

    const handleGameStarted = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      setIsStartingGame(false)
      isStartingGameRef.current = false
      onRoomCreated(roomCode)
    }

    const handleError = ({ code, message }: { code: string, message: string }) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      toast.error(`Erreur : ${message}`, {
        icon: '⚠️',
      })
      isStartingGameRef.current = false
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      toast.error('Le serveur ne répond pas. Veuillez réessayer.', {
        icon: '⏱️',
      })
      setIsStartingGame(false)
      isStartingGameRef.current = false
    }, 5000)

    socket.on('game:start', handleGameStarted)
    socket.on('error', handleError)

    if (!questionsWithTimer || questionsWithTimer.length === 0) {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      socket.off('game:start', handleGameStarted)
      socket.off('error', handleError)
      toast.error('Erreur : Aucune question disponible après traitement.', {
        icon: '❌',
      })
      setIsStartingGame(false)
      isStartingGameRef.current = false
      return
    }

    socket.emit('game:start', {
      roomCode,
      questions: questionsWithTimer,
      defaultTimeLimit: timeLimit,
      questionCount: questionCount
    })
    } catch (error) {
      setIsStartingGame(false)
      isStartingGameRef.current = false
    }
  }

  if (!isSoloMode && !roomCode) {
    return (
      <RoomConnectingState
        isConnecting={isConnecting}
        error={error}
        onBack={onBack}
      />
    )
  }

  const getStartError = (): string | null => {
    if (isSoloMode) {
      if (availableQuestionsCount === 0) return 'Aucune question disponible'
      if (questionCount === 0) return 'Sélectionnez au moins une question'
      return null
    }
    if (!currentPlayerName) return 'Vous devez définir votre nom pour démarrer'
    if (players.length === 0) return 'Attendez qu\'au moins un joueur rejoigne'
    if (availableQuestionsCount === 0) return 'Aucune question disponible'
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
            {isSoloMode ? '🎮 Partie Solo' : `Salon ${roomCode}`}
          </h1>
          <p className="text-secondary">
            {isSoloMode 
              ? 'Configurez votre partie et commencez à jouer'
              : (players.find(p => p.isHost) && `👑 Host: ${players.find(p => p.isHost)?.name}`)
            }
          </p>
        </div>
        {!isSoloMode && (
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              className="btn btn-secondary"
              onClick={handleCopyLink}
            >
              {copied ? '✓ Copié !' : '📋 Partager'}
            </button>
          </div>
        )}
      </div>

      {/* Main Layout: 2 Columns */}
      <div className="grid-2" style={{ flex: 1, alignItems: 'start' }}>
        {!isSoloMode && (
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
        )}

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
          availableQuestionsCount={(() => {
            const num = Number(availableQuestionsCount)
            return (Number.isNaN(num) || !Number.isFinite(num) || num < 0) ? 0 : num
          })()}
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
          canStart={isSoloMode 
            ? (availableQuestionsCount > 0 && questionCount > 0 && questionCount <= availableQuestionsCount)
            : (!!currentPlayerName && players.length > 0 && availableQuestionsCount > 0)
          }
          startError={getStartError()}
          isStarting={isStartingGame}
        />
      </div>
    </div>
  )
}
