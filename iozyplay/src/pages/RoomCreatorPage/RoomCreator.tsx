import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './RoomCreator.module.scss'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Category, Question } from '@/types'
import type { Player } from '@/lib/game/types'
import { getSocket, disconnectSocketIfConnected } from '@/utils/socket'
import { soundManager } from '@/utils/sounds'
import { useRoomSocket, type UseRoomSocketCreateResult } from '@/hooks/useRoomSocket'
import { TIMING, QUESTION_COUNT } from '@/services/gameService'
import { QuestionService } from '@/services/questionService'
import RoomConnectingState from './ui/RoomConnectingState'
import RoomPlayersPanel from './ui/RoomPlayersPanel'
import RoomConfigPanel from './ui/RoomConfigPanel'

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
  onBack,
}: RoomCreatorProps) {
  const isSoloMode = gameMode === 'solo'
  const [copied, setCopied] = useState(false)
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
  const [timeLimit, setTimeLimit] = useState<number>(TIMING.DEFAULT_TIME_LIMIT)

  const [availableQuestionsCount, setAvailableQuestionsCount] = useState<number>(0)
  const [questionCount, setQuestionCount] = useState<number>(QUESTION_COUNT.MIN)
  const [isStartingGame, setIsStartingGame] = useState(false)
  const isStartingGameRef = useRef(false)

  const [soloPlayers, setSoloPlayers] = useState<Player[]>([])
  const [soloCurrentPlayerName, setSoloCurrentPlayerName] = useState('')

  const socketRoom = useRoomSocket({
    mode: 'create',
    categories: categories as string[],
    playerName: playerName || 'Hôte',
    timeLimit,
    enabled: !isSoloMode,
    skipLeaveOnUnmountRef: isStartingGameRef,
    onRoomCreated: (_, room) => {
      soundManager.playSuccess()
      const hostPlayer = room.players?.find((p: { isHost?: boolean }) => p.isHost)
      if (hostPlayer) setPlayerName(hostPlayer.name)
    },
  })

  const socketCreate = socketRoom as UseRoomSocketCreateResult
  const roomCode = isSoloMode ? null : socketCreate.roomCode
  const players: Player[] = isSoloMode ? soloPlayers : socketCreate.players
  const shareLink = isSoloMode ? '' : socketCreate.shareLink
  const currentPlayerName = isSoloMode ? soloCurrentPlayerName : socketCreate.currentPlayerName
  const isConnecting = isSoloMode ? false : socketCreate.isConnecting
  const error = isSoloMode ? null : socketCreate.error
  const leaveRoom = socketCreate.leaveRoom

  useEffect(() => {
    if (isSoloMode) {
      setSoloCurrentPlayerName(initialPlayerName || 'Joueur')
      setPlayerName(initialPlayerName || 'Joueur')
      setSoloPlayers([{ id: 'solo', name: initialPlayerName || 'Joueur', score: 0, isHost: true }])
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
        const defaultCount = Math.max(
          QUESTION_COUNT.MIN,
          Math.min(QUESTION_COUNT.DEFAULT, maxCount)
        )

        setQuestionCount((prev) => {
          // Vérifier que prev est un nombre valide
          const prevValue =
            typeof prev === 'number' && !isNaN(prev) && isFinite(prev) && prev >= QUESTION_COUNT.MIN
              ? prev
              : null

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

  const handleSetName = () => {
    if (!playerName.trim() || !roomCode) return

    const socket = getSocket()
    if (!socket) return

    socket.emit('update-player-name', {
      roomCode,
      playerName: playerName.trim(),
    })

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
        const questionsWithTimer = QuestionService.applyDefaultTimeLimit(
          limitedQuestions,
          timeLimit
        )

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

      const handleError = ({ code, message }: { code: string; message: string }) => {
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
        questionCount: questionCount,
      })
    } catch (error) {
      setIsStartingGame(false)
      isStartingGameRef.current = false
    }
  }

  if (!isSoloMode && !roomCode) {
    return <RoomConnectingState isConnecting={isConnecting} error={error} onBack={onBack} />
  }

  const getStartError = (): string | null => {
    if (isSoloMode) {
      if (availableQuestionsCount === 0) return 'Aucune question disponible'
      if (questionCount === 0) return 'Sélectionnez au moins une question'
      return null
    }
    if (!currentPlayerName) return 'Vous devez définir votre nom pour démarrer'
    if (players.length === 0) return "Attendez qu'au moins un joueur rejoigne"
    if (availableQuestionsCount === 0) return 'Aucune question disponible'
    return null
  }

  return (
    <div className={styles.layout}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>
            {isSoloMode ? '🎮 Partie Solo' : `Salon ${roomCode}`}
          </h1>
          <p className={ds.textSecondary}>
            {isSoloMode
              ? 'Configurez votre partie et commencez à jouer'
              : (() => {
                  const host = players.find((p: Player) => p.isHost)
                  return host ? `👑 Host: ${host.name}` : null
                })()}
          </p>
        </div>
        {!isSoloMode && (
          <div className={styles.headerActions}>
            <button className={`${ds.btn} ${ds.btnSecondary}`} onClick={handleCopyLink}>
              {copied ? '✓ Copié !' : '📋 Partager'}
            </button>
          </div>
        )}
      </div>

      {/* Main Layout: 2 Columns */}
      <div className={`${ds.grid2} ${styles.mainGrid}`}>
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
            return Number.isNaN(num) || !Number.isFinite(num) || num < 0 ? 0 : num
          })()}
          onTimeLimitChange={setTimeLimit}
          onQuestionCountChange={setQuestionCount}
          onStartGame={handleStartGame}
          onBack={() => {
            leaveRoom()
            onBack()
          }}
          canStart={
            isSoloMode
              ? availableQuestionsCount > 0 &&
                questionCount > 0 &&
                questionCount <= availableQuestionsCount
              : !!currentPlayerName && players.length > 0 && availableQuestionsCount > 0
          }
          startError={getStartError()}
          isStarting={isStartingGame}
        />
      </div>
    </div>
  )
}
