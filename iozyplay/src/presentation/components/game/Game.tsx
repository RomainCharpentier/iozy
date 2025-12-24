import { useState, useRef, useEffect } from 'react'
import QuestionCard from './question/QuestionCard'
import Score from './ui/Score'
import GameSettingsPopup from './settings/GameSettingsPopup'
import GameTopBar from './ui/GameTopBar'
import PlayersPanel from './ui/PlayersPanel'
import GameLoadingState from './ui/GameLoadingState'
import { Category, Question, GameMode, Player } from '../../../types'
import { getSocket } from '../../../utils/socket'
import { getPlayerId } from '../../../utils/playerId'
import { GameService } from '../../../services/gameService'
import { TIMING } from '../../../constants/timing'

interface GameProps {
  questions: Question[]
  categories: Category[]
  gameMode: GameMode
  players: Player[]
  roomCode?: string | null
  onEndGame: () => void
  onRestartWithNewCategories?: (categories: Category[], questions: Question[]) => void
}

export default function Game({ questions, categories, gameMode, players, roomCode, onEndGame, onRestartWithNewCategories }: GameProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [gamePlayers, setGamePlayers] = useState<Player[]>(players)
  const [showScore, setShowScore] = useState(false)
  const [isHost, setIsHost] = useState(true)
  const [gameStarted, setGameStarted] = useState(gameMode === 'solo')
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  // En mode multijoueur, initialiser avec un tableau vide car les questions viennent du serveur
  const [gameQuestions, setGameQuestions] = useState<Question[]>(
    gameMode === 'online' ? [] : questions
  )
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false)
  // En mode multijoueur, initialiser avec un tableau vide car les questions viennent du serveur
  const questionsRef = useRef<Question[]>(gameMode === 'online' ? [] : questions)
  const timeoutRefs = useRef<number[]>([])
  const revealTimerStartedRef = useRef<boolean>(false) // Pour éviter de démarrer le timer du reveal plusieurs fois
  const mediaStartTimeRef = useRef<number | null>(null) // Timestamp quand le média commence vraiment à jouer
  const isTransitioningRef = useRef(false)
  const questionAnsweredByRef = useRef<string | null>(null)
  const timerIntervalRef = useRef<number | null>(null)
  const gameStartedAtRef = useRef<number | null>(null)
  const gameDurationMsRef = useRef<number | null>(null)
  const serverTimeOffsetRef = useRef<number>(0) // Offset entre temps serveur et temps client
  const [waitingForGo, setWaitingForGo] = useState<boolean>(gameMode === 'online') // En mode multijoueur, on attend toujours le signal "go" au début
  const mediaReadyRef = useRef<boolean>(false) // Indique si le média est préchargé
  const goAtRef = useRef<number | null>(null) // Timestamp du signal "go"
  const [gameStep, setGameStep] = useState<string>('loading') // Étape actuelle: loading, ready, starting, playing
  const handleTimeUpRef = useRef<(() => void) | null>(null) // Référence à handleTimeUp pour l'utiliser dans startTimerCalculation

  useEffect(() => {
    if (gameQuestions.length === 0) return
    questionsRef.current = gameQuestions
    if (currentQuestionIndex >= gameQuestions.length) {
      setCurrentQuestionIndex(0)
    }
    setShowScore(false)
    isTransitioningRef.current = false
    questionAnsweredByRef.current = null
  }, [gameQuestions])

  useEffect(() => {
    // En mode solo, utiliser les questions des props
    if (gameMode === 'solo' && questions.length > 0) {
      if (gameQuestions.length === 0 || JSON.stringify(gameQuestions) !== JSON.stringify(questions)) {
        setGameQuestions(questions)
      }
    }
    // En mode multijoueur, les questions viennent uniquement du serveur via game:start
    // Ne pas utiliser les questions des props pour éviter les conflits
  }, [questions, gameMode, gameQuestions])

  useEffect(() => {
    setGamePlayers(players.map(p => ({ ...p, score: 0 })))
    setShowScore(false)
    setCurrentQuestionIndex(0)
  }, [])

  useEffect(() => {
    if (gameQuestions.length === 0) return
    if (showScore) return
    if (isTransitioningRef.current) return

    const isBeyondLastQuestion = currentQuestionIndex >= gameQuestions.length

    if (isBeyondLastQuestion) {
      const timeoutId = window.setTimeout(() => {
        if (!isTransitioningRef.current) {
          setShowScore(true)
        }
      }, TIMING.REVEAL_DELAY)

      return () => clearTimeout(timeoutId)
    }
  }, [currentQuestionIndex, gameQuestions.length, showScore])

  // Fonction pour quitter le salon proprement
  const leaveRoom = () => {
    if (gameMode === 'online' && roomCode) {
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('room:leave', { roomCode })
      }
    }
  }

  const handleMediaReady = () => {
    if (!gameMode || gameMode !== 'online' || !roomCode) {
      return
    }

    // Éviter d'envoyer plusieurs fois game:ready pour le même média
    if (mediaReadyRef.current) {
      return
    }

    const socket = getSocket()
    if (!socket?.connected) {
      console.error('[Game] handleMediaReady: Socket non connecté!', { socket: !!socket, connected: socket?.connected })
      return
    }

    // Vérifier que le joueur est bien dans la room avant d'envoyer game:ready
    // Si le joueur n'est pas dans la room, le serveur ne pourra pas le trouver
    // On attend un peu pour laisser le temps au socket de rejoindre la room
    const checkAndSendReady = () => {
      // Toujours marquer le média comme prêt et envoyer "ready" au serveur
      // même si on attend le signal "go" - c'est nécessaire pour la synchronisation
      mediaReadyRef.current = true

      socket.emit('game:ready', { roomCode })
    }

    // Attendre un peu pour s'assurer que le socket est dans la room
    // (room:rejoin peut prendre un peu de temps)
    setTimeout(checkAndSendReady, 500)

    // Si le signal "go" a déjà été reçu, programmer le démarrage du média au bon moment
    // (cela sera géré dans handleGameGo)
  }

  const handleMediaStart = () => {
    // Le média commence vraiment à jouer maintenant
    // C'est le bon moment pour démarrer le timer
    // Cette fonction est appelée pour les deux modes (solo et multi)
    const currentQuestion = gameQuestions[currentQuestionIndex]
    let durationMs: number

    if (gameMode === 'online') {
      if (!gameDurationMsRef.current) {
        console.warn('[Game] handleMediaStart: gameDurationMsRef non disponible en mode online')
        return
      }
      durationMs = gameDurationMsRef.current
    } else {
      // Mode solo : utiliser la durée de la question
      if (!currentQuestion) {
        console.warn('[Game] handleMediaStart: currentQuestion non disponible en mode solo')
        return
      }
      durationMs = (currentQuestion.timeLimit || TIMING.DEFAULT_TIME_LIMIT) * 1000
    }

    const now = Date.now()
    mediaStartTimeRef.current = now

    // Réinitialiser les états avant de démarrer le timer
    setIsTimeUp(false)
    revealTimerStartedRef.current = false

    // Initialiser le temps restant correctement AVANT de démarrer le timer
    const initialRemaining = durationMs / 1000
    setTimeRemaining(initialRemaining)

    // Démarrer le timer maintenant que le média joue vraiment
    // Utiliser la même logique pour les deux modes
    startTimerCalculation(now, durationMs, now, undefined, undefined)
  }

  // Nettoyer le timer de calcul du temps restant
  const clearTimerInterval = () => {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  const startTimerCalculation = (
    startedAt: number,
    durationMs: number,
    receivedAt?: number,
    serverTimeRemainingMs?: number,
    serverTime?: number
  ) => {
    // Éviter le double démarrage du timer
    if (gameStartedAtRef.current !== null && gameDurationMsRef.current !== null) {
      return
    }

    clearTimerInterval()

    // Réinitialiser les états au démarrage du timer
    setIsTimeUp(false)
    revealTimerStartedRef.current = false

    gameStartedAtRef.current = startedAt
    gameDurationMsRef.current = durationMs

    // Utiliser le temps restant calculé par le serveur si disponible
    if (serverTimeRemainingMs !== undefined && serverTime !== undefined && receivedAt) {
      serverTimeOffsetRef.current = serverTime - receivedAt
      const initialRemaining = serverTimeRemainingMs / 1000
      setTimeRemaining(initialRemaining)
      setIsTimeUp(initialRemaining === 0)

      const updateTimer = () => {
        if (gameDurationMsRef.current === null) return
        const elapsedSinceReceive = Date.now() - receivedAt
        const remaining = Math.max(0, (serverTimeRemainingMs - elapsedSinceReceive) / 1000)
        setTimeRemaining(remaining)
        setIsTimeUp(remaining === 0)
      }

      updateTimer()
      timerIntervalRef.current = window.setInterval(updateTimer, 100)
      return
    }

    // Calculer depuis startedAt
    // startedAt est le timestamp serveur où la question commence

    // Calculer l'offset entre le temps serveur et le temps client
    // Si on a serverTime et receivedAt, on peut calculer l'offset exact
    if (receivedAt && serverTime !== undefined) {
      // Offset = différence entre temps serveur et temps client au moment de la réception
      // Cet offset représente la différence entre l'horloge serveur et l'horloge client
      serverTimeOffsetRef.current = serverTime - receivedAt
    } else if (receivedAt) {
      // Si on n'a pas serverTime mais on a receivedAt, estimer l'offset
      // en supposant que startedAt correspond approximativement au temps client quand on l'a reçu
      // Mais startedAt peut être dans le futur (goAt), donc on utilise receivedAt comme référence
      serverTimeOffsetRef.current = startedAt - receivedAt
    } else {
      // Fallback : pas d'offset
      serverTimeOffsetRef.current = 0
    }

    const updateTimer = () => {
      if (gameStartedAtRef.current === null || gameDurationMsRef.current === null) {
        return
      }

      const clientNow = Date.now()
      // Calculer le temps écoulé depuis le début de la question
      // gameStartedAtRef.current est maintenant un timestamp client (pas serveur)
      // donc on peut le comparer directement avec clientNow
      const elapsed = Math.max(0, clientNow - gameStartedAtRef.current)
      // Calculer le temps restant
      const remaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

      setTimeRemaining(remaining)

      // isTimeUp devient true seulement quand le temps de guess est complètement écoulé
      const hasFullyElapsed = elapsed >= gameDurationMsRef.current
      const newIsTimeUp = hasFullyElapsed && gameStartedAtRef.current !== null && gameDurationMsRef.current !== null

      setIsTimeUp(newIsTimeUp)

      // Si le timer de guess atteint 0, démarrer le timer du reveal
      // On vérifie !revealTimerStartedRef.current pour éviter de démarrer le timer plusieurs fois
      if (newIsTimeUp && !revealTimerStartedRef.current) {
        revealTimerStartedRef.current = true

        // Démarrer le timer du reveal (même durée que le guess)
        if (gameDurationMsRef.current !== null) {
          const revealDurationMs = gameDurationMsRef.current

          // Programmer la fin du reveal
          const revealTimer = window.setTimeout(() => {
            // Le serveur devrait gérer le passage à la question suivante
            // mais on peut aussi appeler handleTimeUp pour le mode solo
            if (gameMode === 'solo' && handleTimeUpRef.current) {
              handleTimeUpRef.current()
            }
          }, revealDurationMs)

          timeoutRefs.current.push(revealTimer)
        }
      }

      // Si le temps est écoulé, appeler handleTimeUp une seule fois (mode solo seulement, avant le reveal)
      if (newIsTimeUp && !isTimeUp && gameMode === 'solo' && !revealTimerStartedRef.current && handleTimeUpRef.current) {
        handleTimeUpRef.current()
      }
    }

    // Mettre à jour immédiatement
    updateTimer()

    // Programmer les mises à jour régulières
    timerIntervalRef.current = window.setInterval(updateTimer, 100)
  }

  // Initialiser waitingForGo en mode multijoueur
  useEffect(() => {
    if (gameMode === 'online') {
      setWaitingForGo(true)
    } else {
      setWaitingForGo(false)
    }
  }, [gameMode])

  useEffect(() => {
    if (gameMode !== 'online' || !roomCode) return

    const socket = getSocket()
    if (!socket) return

    const playerId = getPlayerId()

    // Gérer beforeunload pour quitter proprement
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      leaveRoom()
      // Note: Les navigateurs modernes ignorent le message personnalisé
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Attendre que le socket soit connecté avant de continuer
    if (!socket.connected) {
      const handleConnect = () => {
        socket.off('connect', handleConnect)
        // Rejoindre le salon après reconnexion et demander l'état
        socket.emit('room:rejoin', { roomCode, playerId })
        socket.emit('game:get-state', { roomCode })
      }
      socket.on('connect', handleConnect)
      return () => {
        socket.off('connect', handleConnect)
        window.removeEventListener('beforeunload', handleBeforeUnload)
        clearTimerInterval()
      }
    }

    // S'assurer que le socket est dans la room
    // Le socket devrait déjà être dans la room via room:join ou room:rejoin,
    // mais on vérifie et on rejoint si nécessaire
    if (socket.connected && roomCode) {
      // Vérifier si le socket est dans la room (socket.rooms n'est pas accessible côté client)
      // On émet room:rejoin pour s'assurer que le socket est dans la room
      socket.emit('room:rejoin', { roomCode, playerId })
    }

    const handleRoomState = (state: any) => {
      if (state.players?.length) {
        setGamePlayers(state.players)
        setIsHost(state.players.find((p: Player) => p.id === playerId)?.isHost || false)
      }

      if (state.questions?.length) {
        setGameQuestions(state.questions)
        questionsRef.current = state.questions
      }

      if (state.game && state.phase === 'playing') {
        setGameStarted(true)
        setShowScore(false)

        const newGameStep = state.game.step || 'loading'
        setGameStep(newGameStep)

        if (state.game.questionIndex !== undefined) {
          setCurrentQuestionIndex(state.game.questionIndex)
        }

        // Stocker durationMs pour que handleMediaStart puisse l'utiliser
        if (state.game.durationMs) {
          gameDurationMsRef.current = state.game.durationMs
        }

        if (newGameStep === 'playing') {
          // En mode multijoueur, ne pas démarrer le timer ici
          // Le timer sera démarré dans handleMediaStart quand le média commence vraiment à jouer
          setWaitingForGo(false)
          setIsTimeUp(false)
          setTimeRemaining(0) // Sera mis à jour dans handleMediaStart
        } else {
          setWaitingForGo(true)
        }
      } else if (state.phase === 'waiting') {
        setGameStarted(false)
        clearTimerInterval()
      } else if (state.phase === 'finished') {
        setShowScore(true)
        clearTimerInterval()
      } else {
        clearTimerInterval()
      }
    }

    const handleGameStarted = ({
      questions: serverQuestions,
      questionIndex,
      players: updatedPlayers
    }: {
      currentQuestion: Question
      questions?: Question[]
      questionIndex: number
      players?: Player[]
      startedAt?: number
      durationMs?: number
    }) => {

      if (serverQuestions?.length) {
        setGameQuestions(serverQuestions)
        questionsRef.current = serverQuestions
      } else {
        console.error('[Game] handleGameStarted: Aucune question reçue!')
      }

      setCurrentQuestionIndex(questionIndex)
      setGameStarted(true)
      setShowScore(false)

      if (updatedPlayers?.length) {
        setGamePlayers(updatedPlayers)
      }

      setWaitingForGo(true)
      mediaReadyRef.current = false
      goAtRef.current = null
      setGameStep('loading')
      clearTimerInterval()

      // Réinitialiser le timer au démarrage de la partie
      setIsTimeUp(false)
      setTimeRemaining(0) // Sera mis à jour quand le timer démarre
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
    }

    const handleGameGo = ({ goAt, durationMs }: { goAt: number, startedAt: number, durationMs: number, serverTime?: number }) => {
      goAtRef.current = goAt
      gameDurationMsRef.current = durationMs
      setGameStep('starting')
      setWaitingForGo(true)

      const startGameAtGoTime = () => {
        setWaitingForGo(false)
        setGameStep('playing')

        // Réinitialiser les états - le timer sera démarré dans handleMediaStart
        setIsTimeUp(false)
        revealTimerStartedRef.current = false
        mediaStartTimeRef.current = null
        setTimeRemaining(0)

        // Fallback : si handleMediaStart n'est pas appelé dans les 3 secondes, démarrer le timer quand même
        const fallbackTimer = setTimeout(() => {
          if (mediaStartTimeRef.current === null &&
            gameDurationMsRef.current &&
            mediaReadyRef.current &&
            !waitingForGo &&
            gameStartedAtRef.current === null) {
            console.warn('[Game] Fallback: onMediaStart pas appelé après 3s, démarrage du timer')
            const fallbackNow = Date.now()
            mediaStartTimeRef.current = fallbackNow
            startTimerCalculation(fallbackNow, gameDurationMsRef.current, fallbackNow, undefined, undefined)
            setTimeRemaining(gameDurationMsRef.current / 1000)
            setIsTimeUp(false)
          }
        }, 3000)

        // Nettoyer le fallback si handleMediaStart est appelé
        const cleanupTimerRef = { current: null as NodeJS.Timeout | null }
        cleanupTimerRef.current = setInterval(() => {
          if (mediaStartTimeRef.current !== null || gameStartedAtRef.current !== null) {
            clearTimeout(fallbackTimer)
            if (cleanupTimerRef.current) {
              clearInterval(cleanupTimerRef.current)
              cleanupTimerRef.current = null
            }
          }
        }, 100)

        setTimeout(() => {
          if (cleanupTimerRef.current) {
            clearInterval(cleanupTimerRef.current)
            cleanupTimerRef.current = null
          }
        }, 4000)
      }

      const scheduleStart = (targetTime: number) => {
        let rafId: number | null = null
        const checkStart = () => {
          const now = Date.now()
          if (now >= targetTime) {
            startGameAtGoTime()
            if (rafId !== null) cancelAnimationFrame(rafId)
          } else {
            rafId = requestAnimationFrame(checkStart)
          }
        }
        rafId = requestAnimationFrame(checkStart)
      }

      const waitForMediaAndStart = () => {
        let rafId: number | null = null
        let timeoutId: NodeJS.Timeout | null = null
        const checkMedia = () => {
          if (mediaReadyRef.current) {
            scheduleStart(goAt)
            if (rafId !== null) cancelAnimationFrame(rafId)
            if (timeoutId !== null) clearTimeout(timeoutId)
          } else {
            rafId = requestAnimationFrame(checkMedia)
          }
        }
        rafId = requestAnimationFrame(checkMedia)

        // Timeout de sécurité : démarrer le timer même si le média n'est pas prêt après 2 secondes
        timeoutId = setTimeout(() => {
          scheduleStart(goAt)
          if (rafId !== null) cancelAnimationFrame(rafId)
        }, 2000)
      }

      if (mediaReadyRef.current) {
        scheduleStart(goAt)
      } else {
        waitForMediaAndStart()
      }
    }

    const handleCorrectAnswer = ({
      playerId,
      players: updatedPlayers
    }: {
      playerId: string
      playerName: string
      score: number
      players?: Player[]
    }) => {
      questionAnsweredByRef.current = playerId
      if (updatedPlayers) {
        setGamePlayers(updatedPlayers)
      }
    }

    const handleNextQuestion = ({
      questions: serverQuestions,
      questionIndex
    }: {
      currentQuestion?: Question
      questions?: Question[]
      questionIndex: number
      durationMs?: number
    }) => {
      if (serverQuestions?.length) {
        setGameQuestions(serverQuestions)
        questionsRef.current = serverQuestions
      }

      setCurrentQuestionIndex(questionIndex)
      questionAnsweredByRef.current = null
      isTransitioningRef.current = false
      setShowScore(false)

      setWaitingForGo(true)
      mediaReadyRef.current = false
      goAtRef.current = null
      setGameStep('loading')
      clearTimerInterval()

      // Réinitialiser le timer pour la nouvelle question
      // Le timer sera démarré dans handleMediaStart quand le média commence vraiment à jouer
      setIsTimeUp(false)
      setTimeRemaining(0) // Reste à 0 jusqu'à ce que le média démarre
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
    }

    const handleGameEnded = ({ players: finalPlayers }: { players: Player[] }) => {
      setGamePlayers(finalPlayers)
      setShowScore(true)
      clearTimerInterval()
    }

    const handleError = ({ code, message }: { code: string, message: string }) => {
      // Si le joueur n'est pas trouvé dans la room, essayer de rejoindre avec room:join
      if (code === 'PLAYER_NOT_FOUND' && roomCode) {
        // Essayer de rejoindre la room avec room:join (peut-être que le joueur n'a jamais rejoint)
        socket.emit('room:join', {
          roomCode,
          playerId,
          playerName: 'Joueur' // Nom par défaut
        })
        return
      }

      // Pour les autres erreurs, afficher une alerte
      if (code !== 'GAME_ALREADY_STARTED') {
        console.error('[Game] Erreur serveur:', { code, message })
        // Ne pas afficher d'alerte pour les erreurs non critiques
        // alert(`Erreur serveur : ${message}`)
      }
    }

    // Écouter tous les événements
    const handleGameSync = ({ durationMs, questionIndex }: {
      startedAt: number
      durationMs: number
      timeRemainingMs: number
      serverTime: number
      questionIndex: number
    }) => {
      // Synchronisation directe pour un joueur qui rejoint une partie en cours
      // Mais ne pas démarrer le timer ici - attendre handleMediaStart
      setWaitingForGo(false)
      setGameStep('playing')
      setCurrentQuestionIndex(questionIndex)
      // Stocker les valeurs pour que handleMediaStart puisse les utiliser
      gameDurationMsRef.current = durationMs
      // Ne pas démarrer le timer ici - attendre handleMediaStart
      setIsTimeUp(false)
      setTimeRemaining(0) // Sera mis à jour dans handleMediaStart
    }

    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('game:go', handleGameGo)
    socket.on('game:sync', handleGameSync)
    socket.on('game:next', handleNextQuestion)
    socket.on('game:correct-answer', handleCorrectAnswer)
    socket.on('game:end', handleGameEnded)
    socket.on('error', handleError)

    // Gérer la reconnexion
    socket.on('reconnect', () => {
      socket.emit('room:rejoin', { roomCode, playerId })
    })

    // S'assurer que le socket est dans la room
    // Attendre d'abord que room:joined ou room:rejoined soit reçu avant de continuer
    let hasJoinedRoom = false

    const handleRoomJoinedOrRejoined = () => {
      if (!hasJoinedRoom) {
        hasJoinedRoom = true
        // Demander l'état actuel du jeu une fois qu'on est sûr d'être dans la room
        socket.emit('game:get-state', { roomCode })
      }
    }

    socket.once('room:joined', handleRoomJoinedOrRejoined)
    socket.once('room:rejoined', handleRoomJoinedOrRejoined)

    // Essayer de rejoindre la room
    socket.emit('room:rejoin', { roomCode, playerId })

    // Timeout de sécurité : si on ne reçoit pas room:joined/rejoined après 2 secondes,
    // essayer room:join (peut-être que le joueur n'a jamais rejoint)
    const joinTimeout = setTimeout(() => {
      if (!hasJoinedRoom) {
        socket.emit('room:join', {
          roomCode,
          playerId,
          playerName: 'Joueur' // Nom par défaut si on n'a pas le nom
        })
      }
    }, 2000)

    // Nettoyer le timeout si on reçoit room:joined/rejoined
    socket.once('room:joined', () => {
      clearTimeout(joinTimeout)
    })
    socket.once('room:rejoined', () => {
      clearTimeout(joinTimeout)
    })

    return () => {
      socket.off('room:state', handleRoomState)
      socket.off('game:start', handleGameStarted)
      socket.off('game:go', handleGameGo)
      socket.off('game:sync', handleGameSync)
      socket.off('game:next', handleNextQuestion)
      socket.off('game:correct-answer', handleCorrectAnswer)
      socket.off('game:end', handleGameEnded)
      socket.off('error', handleError)
      socket.off('reconnect')
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearTimerInterval()
    }
  }, [gameMode, roomCode])

  // Le host est maintenant déterminé depuis room:state

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
    }
  }, [])

  const handleTimerUpdate = (timeRemaining: number, isTimeUp: boolean) => {
    setTimeRemaining(timeRemaining)
    setIsTimeUp(isTimeUp)
  }

  const handleAnswer = (isCorrect: boolean, _timeRemaining: number, _playerId?: string) => {
    if (showScore) return
    if (isTransitioningRef.current) return

    isTransitioningRef.current = true

    if (isCorrect) {
      if (gameMode === 'solo') {
        setScore(prev => prev + 1)
        const timeoutId = window.setTimeout(() => {
          questionAnsweredByRef.current = null
          setCurrentQuestionIndex(prev => {
            const totalQuestions = questionsRef.current.length
            if (GameService.canGoToNextQuestion(prev, totalQuestions)) {
              isTransitioningRef.current = false
              return prev + 1
            } else {
              isTransitioningRef.current = false
              setTimeout(() => setShowScore(true), TIMING.REVEAL_DELAY)
              return prev
            }
          })
        }, TIMING.QUESTION_TRANSITION_DELAY)
        timeoutRefs.current.push(timeoutId)
      } else if (gameMode === 'online' && roomCode) {
        const socket = getSocket()
        if (socket) {
          socket.emit('game:answer', {
            roomCode,
            answer: gameQuestions[currentQuestionIndex]?.answer || ''
          })
        }
        // En mode multijoueur, le serveur décide quand passer à la question suivante
        // On ne modifie pas currentQuestionIndex ici
        questionAnsweredByRef.current = null
        isTransitioningRef.current = false
      }
    } else {
      isTransitioningRef.current = false
    }
  }

  const handleTimeUp = () => {
    if (showScore) return
    if (isTransitioningRef.current) return

    if (gameMode === 'solo') {
      isTransitioningRef.current = true
      questionAnsweredByRef.current = null

      const timeoutId = window.setTimeout(() => {
        setCurrentQuestionIndex(prev => {
          const totalQuestions = questionsRef.current.length
          if (GameService.canGoToNextQuestion(prev, totalQuestions)) {
            isTransitioningRef.current = false
            return prev + 1
          } else {
            isTransitioningRef.current = false
            setTimeout(() => setShowScore(true), TIMING.REVEAL_DELAY)
            return prev
          }
        })
      }, TIMING.REVEAL_DELAY)
      timeoutRefs.current.push(timeoutId)
    } else if (gameMode === 'online') {
      // En mode multijoueur, le serveur gère le timer et décide quand passer à la question suivante
      // Le serveur enverra game:next quand le timer expire
      questionAnsweredByRef.current = null
    }
  }

  // Mettre à jour la ref pour que startTimerCalculation puisse l'utiliser
  useEffect(() => {
    handleTimeUpRef.current = handleTimeUp
  }, [handleTimeUp])

  const handleRestart = () => {
    setShowScore(false)
    setCurrentQuestionIndex(0)
    setScore(0)
    questionAnsweredByRef.current = null
    isTransitioningRef.current = false

    if (gameMode === 'online' && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:restart', { roomCode })
        setGameStarted(false)
      }
    } else {
      setGamePlayers(players.map(p => ({ ...p, score: 0 })))
    }
  }

  const handleModifySettings = () => {
    setShowScore(false)
    setShowSettingsPopup(true)
  }

  const handleSettingsSaved = (newCategories: Category[], newQuestions: Question[], timeLimit: number, questionCount: number) => {
    setShowSettingsPopup(false)
    setShowScore(false)
    setCurrentQuestionIndex(0)
    setScore(0)
    questionAnsweredByRef.current = null
    isTransitioningRef.current = false

    if (gameMode === 'online' && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:restart-with-categories', {
          roomCode,
          questions: newQuestions,
          categories: newCategories,
          defaultTimeLimit: timeLimit,
          questionCount: questionCount
        })
        setGameStarted(false)
      }
    } else {
      if (onRestartWithNewCategories) {
        onRestartWithNewCategories(newCategories, newQuestions)
      } else {
        window.location.reload()
      }
    }
  }

  const getCurrentTimeLimit = (): number => {
    if (gameQuestions.length > 0 && gameQuestions[0].timeLimit) {
      return gameQuestions[0].timeLimit
    }
    return TIMING.DEFAULT_TIME_LIMIT
  }

  // En mode multijoueur, gérer différemment l'absence de questions
  if (gameMode === 'online') {
    if (!gameStarted) {
      return (
        <GameLoadingState
          message="En attente du démarrage..."
          subMessage="L'hôte va démarrer la partie."
          showSpinner={true}
        />
      )
    }

    // Si la partie a démarré mais pas encore de questions, attendre
    if (gameQuestions.length === 0) {
      return (
        <GameLoadingState
          message="Chargement de la partie..."
          subMessage="Récupération des questions depuis le serveur."
          showSpinner={true}
        />
      )
    }
  } else {
    // En mode solo, vérifier les questions normalement
    if (gameQuestions.length === 0) {
      return (
        <GameLoadingState
          message="Aucune question disponible pour les catégories sélectionnées."
          showSpinner={false}
          onBack={onEndGame}
        />
      )
    }
  }

  if (currentQuestionIndex < 0 || currentQuestionIndex >= gameQuestions.length) {
    return (
      <GameLoadingState
        message="Erreur : Index de question invalide."
        showSpinner={false}
        onBack={onEndGame}
      />
    )
  }

  const currentQuestion = gameQuestions[currentQuestionIndex]

  if (!currentQuestion) {
    return (
      <GameLoadingState
        message="Erreur : Question introuvable."
        showSpinner={false}
        onBack={onEndGame}
      />
    )
  }

  return (
    <div className="game" data-testid="game-screen">
      <GameTopBar
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={gameQuestions.length}
        currentQuestion={currentQuestion}
        timeRemaining={timeRemaining}
        isTimeUp={isTimeUp}
        onQuit={() => {
          leaveRoom()
          onEndGame()
        }}
      />

      {/* Main: Zone media/waveform centrée */}
      <div className="game-main" data-testid="game-main">
        <QuestionCard
          question={currentQuestion}
          onAnswer={handleAnswer}
          onTimeUp={handleTimeUp}
          gameMode={gameMode}
          players={gamePlayers}
          questionAnsweredBy={questionAnsweredByRef.current}
          shouldPause={showScore || showSettingsPopup}
          onTimerUpdate={handleTimerUpdate}
          onMediaReady={gameMode === 'online' ? handleMediaReady : undefined}
          onMediaStart={handleMediaStart} // Toujours utiliser handleMediaStart pour démarrer le timer au bon moment
          waitingForGo={waitingForGo}
          gameStep={gameStep}
          externalTimeRemaining={gameMode === 'online' ? timeRemaining : undefined}
          externalIsTimeUp={gameMode === 'online' ? isTimeUp : undefined}
        />
      </div>

      {/* BottomBar: Champ réponse + Bouton valider + Hint */}
      <div className="game-bottombar" data-testid="game-bottombar">
        {/* Le contenu de la bottom bar est géré par QuestionCard */}
      </div>

      {gameMode === 'online' && (
        <PlayersPanel
          players={gamePlayers}
          questionAnsweredBy={questionAnsweredByRef.current}
        />
      )}

      {(showScore || showSettingsPopup) && (
        <div className="modal-overlay" onClick={() => {
          if (showSettingsPopup) {
            setShowSettingsPopup(false)
            setShowScore(true)
          } else {
            onEndGame()
          }
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {showSettingsPopup ? (
              <GameSettingsPopup
                isOpen={true}
                currentCategories={categories}
                currentTimeLimit={getCurrentTimeLimit()}
                currentQuestionCount={gameQuestions.length}
                onSave={handleSettingsSaved}
                onClose={() => {
                  setShowSettingsPopup(false)
                  setShowScore(true)
                }}
                gameMode={gameMode}
              />
            ) : (
              <div className="score-popup-content">
                <Score
                  score={gameMode === 'solo' ? score : 0}
                  totalQuestions={gameQuestions.length}
                  gameMode={gameMode}
                  players={gamePlayers}
                  isHost={isHost}
                  onRestart={handleRestart}
                  onModifySettings={handleModifySettings}
                  onQuit={onEndGame}
                  isPopup={true}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}




