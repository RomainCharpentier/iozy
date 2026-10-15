import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import GameSettingsPopup from '@/pages/GamePage/settings/GameSettingsPopup'
import GameTopBar from '@/pages/GamePage/ui/GameTopBar'
import RoundScreen from '@/pages/GamePage/ui/RoundScreen'
import EndScreen from '@/pages/GamePage/ui/EndScreen'
import LoadingScreen from '@/pages/GamePage/ui/LoadingScreen'
import type { Category, Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo, isOnline } from '@/lib/game/gameMode'
import { getGameModeStrategy } from '@/lib/game/strategies'
import { getSocket, connectSocket, setCurrentRoom, clearCurrentRoom } from '@/utils/socket'
import { getPlayerId } from '@/utils/playerId'
import { GameService, TIMING } from '@/services/gameService'
import { toast } from 'sonner'
import { soundManager } from '@/utils/sounds'
import * as Dialog from '@radix-ui/react-dialog'

interface GameProps {
  questions: Question[]
  categories: Category[]
  gameMode: GameMode
  players: Player[]
  roomCode?: string | null
  onEndGame: () => void
  onRestartWithNewCategories?: (categories: Category[], questions: Question[]) => void
}

export default function Game({
  questions,
  categories,
  gameMode,
  players,
  roomCode,
  onEndGame,
  onRestartWithNewCategories,
}: GameProps) {
  const soloAnswersRef = useRef<string[]>([])

  const strategy = useMemo(
    () =>
      getGameModeStrategy(
        gameMode,
        isSolo(gameMode)
          ? { soloAnswersRef }
          : { roomCode: roomCode ?? null }
      ),
    [gameMode, roomCode]
  )

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [gamePlayers, setGamePlayers] = useState<Player[]>(players)
  const [showScore, setShowScore] = useState(false)
  const [isHost, setIsHost] = useState(true)
  const [gameStarted, setGameStarted] = useState(strategy.getInitialGameStarted())
  const [showSettingsPopup, setShowSettingsPopup] = useState(false)
  const [gameQuestions, setGameQuestions] = useState<Question[]>(
    strategy.getInitialQuestions(questions)
  )
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [phase, setPhase] = useState<'guess' | 'reveal'>('guess')
  const phaseRef = useRef<'guess' | 'reveal'>('guess')
  const isRevealPhase = phase === 'reveal'
  const setIsRevealPhase = (v: boolean) => {
    const p = v ? 'reveal' : 'guess'
    setPhase(p)
    phaseRef.current = p
  }
  const questionsRef = useRef<Question[]>(strategy.getInitialQuestions(questions))
  const timeoutRefs = useRef<number[]>([])
  const revealTimerStartedRef = useRef<boolean>(false) // Éviter double démarrage du timer reveal
  const mediaStartTimeRef = useRef<number | null>(null) // Timestamp quand le média commence vraiment à jouer
  const isTransitioningRef = useRef(false)
  const questionAnsweredByRef = useRef<string | null>(null)
  const timerIntervalRef = useRef<number | null>(null)
  const phaseStartTimeRef = useRef<number | null>(null) // Timestamp du début de la phase actuelle (guess ou reveal)
  const gameDurationMsRef = useRef<number | null>(null)
  const revealStartTimeRef = useRef<number | null>(null) // Pour sync serveur (multi)
  const gameEndedRef = useRef<boolean>(false)
  const successSoundPlayedRef = useRef<boolean>(false) // Pour éviter que le son de fin joue plusieurs fois
  const lastSkipVoteTimeRef = useRef<number>(0) // Pour le debounce
  const [waitingForGo, setWaitingForGo] = useState<boolean>(
    strategy.getInitialWaitingForGo()
  )
  const mediaReadyRef = useRef<boolean>(false) // Indique si le média est préchargé
  const [gameStep, setGameStep] = useState<string>('loading') // Étape actuelle: loading, ready, starting, playing
  const handlePhaseEndRef = useRef<(() => void) | null>(null) // Référence à handlePhaseEnd pour l'utiliser dans startTimerCalculation
  const [skipVotes, setSkipVotes] = useState<Set<string>>(new Set()) // Joueurs qui ont voté skip
  const [correctPlayers, setCorrectPlayers] = useState<Set<string>>(new Set()) // Joueurs qui ont répondu correctement (pour surlignage vert)
  const [answeredPlayers, setAnsweredPlayers] = useState<Set<string>>(new Set()) // Joueurs ayant soumis pendant la phase guess
  const [validatedAnswers, setValidatedAnswers] = useState<Record<string, boolean>>({}) // Réponses validées par le serveur (mode multijoueur)
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, string>>({}) // Réponses des joueurs

  const previousQuestionsRef = useRef<string>('')
  const gameInstanceKeyRef = useRef<number>(0)
  const countdownWarningPlayedRef = useRef<boolean>(false)
  const countdownEndPlayedRef = useRef<boolean>(false)

  useEffect(() => {
    strategy.onMount?.()
  }, [strategy])

  const resetGameState = useCallback(() => {
    setCurrentQuestionIndex(0)
    setScore(0)
    setShowScore(false)
    setPhase('guess')
    phaseRef.current = 'guess'
    setTimeRemaining(0)
    setWaitingForGo(strategy.getInitialWaitingForGo())
    setGameStep('loading')
    setSkipVotes(new Set())
    setCorrectPlayers(new Set())
    setAnsweredPlayers(new Set())
    setValidatedAnswers({})
    setPlayerAnswers({})

    gameEndedRef.current = false
    successSoundPlayedRef.current = false
    isTransitioningRef.current = false
    questionAnsweredByRef.current = null
    mediaReadyRef.current = false
    revealTimerStartedRef.current = false
    mediaStartTimeRef.current = null
    countdownWarningPlayedRef.current = false
    countdownEndPlayedRef.current = false
    phaseStartTimeRef.current = null
    gameDurationMsRef.current = null
    revealStartTimeRef.current = null
    lastSkipVoteTimeRef.current = 0
    strategy.clearAnswersForNextQuestion?.()

    clearTimerInterval()
    timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId))
    timeoutRefs.current = []

    setGamePlayers(players.map((p) => ({ ...p, score: 0 })))
  }, [strategy, players])

  useEffect(() => {
    if (gameQuestions.length === 0) return
    questionsRef.current = gameQuestions

    const currentQuestionsKey = JSON.stringify(gameQuestions.map((q) => q.id || q.mediaUrl))
    const isNewGame =
      previousQuestionsRef.current !== '' && previousQuestionsRef.current !== currentQuestionsKey

    if (isNewGame) {
      resetGameState()
      gameInstanceKeyRef.current += 1
    }

    previousQuestionsRef.current = currentQuestionsKey

    if (currentQuestionIndex >= gameQuestions.length) {
      setCurrentQuestionIndex(0)
    }
    if (!gameEndedRef.current && !isNewGame) {
      setShowScore(false)
    }
    isTransitioningRef.current = false
    questionAnsweredByRef.current = null
  }, [gameQuestions, resetGameState])

  useEffect(() => {
    // En mode solo, utiliser les questions des props
    if (isSolo(gameMode) && questions.length > 0) {
      const questionsKey = JSON.stringify(questions.map((q) => q.id || q.mediaUrl))
      if (gameQuestions.length === 0 || previousQuestionsRef.current !== questionsKey) {
        setGameQuestions(questions)
        // Réinitialiser l'état pour une nouvelle partie
        resetGameState()
      }
    }
    // En mode multijoueur, les questions viennent uniquement du serveur via game:start
    // Ne pas utiliser les questions des props pour éviter les conflits
  }, [questions, gameMode, gameQuestions, resetGameState])

  useEffect(() => {
    if (gameQuestions.length === 0) {
      if (isSolo(gameMode)) {
        toast.error(
          'Aucune question disponible. Veuillez sélectionner des catégories avec des questions.'
        )
        onEndGame()
      }
      return
    }
    if (showScore) return
    if (isTransitioningRef.current) return
    if (gameEndedRef.current) return // Ne pas continuer si la partie est déjà terminée

    const isBeyondLastQuestion = currentQuestionIndex >= gameQuestions.length

    if (isBeyondLastQuestion) {
      // Partie terminée en mode solo
      gameEndedRef.current = true
      clearTimerInterval() // Arrêter le timer
      const timeoutId = window.setTimeout(() => {
        if (!isTransitioningRef.current && gameEndedRef.current) {
          setShowScore(true)
        }
      }, TIMING.REVEAL_DELAY)

      return () => clearTimeout(timeoutId)
    }
  }, [currentQuestionIndex, gameQuestions.length, showScore, gameMode, onEndGame])

  // Initialiser timeRemaining avant le démarrage du média (solo + multi)
  useEffect(() => {
    const q = gameQuestions[currentQuestionIndex]
    if (q && phaseStartTimeRef.current === null && !showScore) {
      const limit = GameService.validateTimeLimit(q.timeLimit)
      setTimeRemaining(limit)
    }
  }, [currentQuestionIndex, gameQuestions, showScore])

  const leaveRoom = () => {
    strategy.leaveRoom()
  }

  const handleMediaReady = useCallback(() => {
    if (!gameMode || !isOnline(gameMode) || !roomCode) {
      return
    }

    // Éviter d'envoyer plusieurs fois game:ready pour le même média
    if (mediaReadyRef.current) {
      return
    }

    const socket = getSocket()
    if (!socket?.connected) {
      console.error('[Game] handleMediaReady: Socket non connecté!', {
        socket: !!socket,
        connected: socket?.connected,
      })
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
  }, [gameMode, roomCode])

  const handleMediaStart = () => {
    // Le média commence vraiment à jouer maintenant
    // C'est le bon moment pour démarrer le timer
    // Cette fonction est appelée pour les deux modes (solo et multi)
    const currentQuestion = gameQuestions[currentQuestionIndex]
    let durationMs: number

    if (isOnline(gameMode)) {
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
      durationMs = GameService.validateTimeLimit(currentQuestion.timeLimit) * 1000
    }

    const now = Date.now()
    mediaStartTimeRef.current = now
    mediaReadyRef.current = true

    setIsRevealPhase(false)
    revealTimerStartedRef.current = false
    countdownWarningPlayedRef.current = false
    countdownEndPlayedRef.current = false

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
    if (phaseStartTimeRef.current !== null && gameDurationMsRef.current !== null) {
      return
    }

    clearTimerInterval()

    // Réinitialiser les états au démarrage du timer
    setIsRevealPhase(false)
    revealTimerStartedRef.current = false

    phaseStartTimeRef.current = startedAt
    gameDurationMsRef.current = durationMs

    // Utiliser le temps restant calculé par le serveur si disponible
    if (serverTimeRemainingMs !== undefined && serverTime !== undefined && receivedAt) {
      const initialRemaining = serverTimeRemainingMs / 1000
      setTimeRemaining(initialRemaining)
      setIsRevealPhase(initialRemaining === 0)

      const updateTimer = () => {
        if (gameEndedRef.current) {
          return
        }

        if (gameDurationMsRef.current === null) return

        const clientNow = Date.now()

        // Si phaseStartTimeRef est défini, on est en phase reveal
        // Utiliser phaseStartTimeRef au lieu de isRevealPhase pour éviter les problèmes de closure
        if (phaseStartTimeRef.current !== null) {
          // phaseStartTimeRef.current est le timestamp client du début du chrono reveal
          // gameDurationMsRef.current contient maintenant la durée de reveal (mise à jour dans handleRevealVideoStart ou handleGameReveal)
          const elapsed = Math.max(0, clientNow - phaseStartTimeRef.current)
          const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

          setTimeRemaining(revealRemaining)
          setIsRevealPhase(true)

          // Si le reveal est terminé, le serveur devrait envoyer game:next
          // Mais on peut aussi vérifier ici pour être sûr
          if (revealRemaining <= 0.1) {
            // Le reveal est terminé, mais on attend le serveur pour passer à la question suivante
            setTimeRemaining(0)
            setIsRevealPhase(true)
          }
          return
        }

        // Phase guess : utiliser le temps restant du serveur
        // Vérifier que receivedAt est défini avant de l'utiliser
        if (receivedAt !== undefined && serverTimeRemainingMs !== undefined) {
          const elapsedSinceReceive = clientNow - receivedAt
          const remaining = Math.max(0, (serverTimeRemainingMs - elapsedSinceReceive) / 1000)
          setTimeRemaining(remaining)
          setIsRevealPhase(remaining === 0)
        } else {
          // Si receivedAt n'est pas défini, on ne peut pas calculer le temps restant
          // Cela ne devrait pas arriver en mode multijoueur, mais on gère le cas
          console.warn('[Game] updateTimer: receivedAt or serverTimeRemainingMs is undefined', {
            receivedAt,
            serverTimeRemainingMs,
          })
        }
      }

      updateTimer()
      // Ne démarrer le timer que s'il n'est pas déjà en cours
      if (timerIntervalRef.current === null) {
        timerIntervalRef.current = window.setInterval(updateTimer, 100)
      }
      return
    }

    // Calculer depuis startedAt (mode solo uniquement)
    const updateTimer = () => {
      if (gameEndedRef.current) {
        return
      }

      if (phaseStartTimeRef.current === null || gameDurationMsRef.current === null) {
        return
      }

      const clientNow = Date.now()

      // Si on est en phase reveal, calculer le temps restant (utiliser phaseRef pour éviter closure stale)
      if (phaseRef.current === 'reveal') {
        // Si revealStartTimeRef est défini (timestamp serveur), l'utiliser pour synchroniser précisément
        if (phaseStartTimeRef.current !== null) {
          // phaseStartTimeRef.current est le timestamp client du début du chrono (chrono à la durée complète)
          // Le chrono compte depuis ce moment jusqu'à 0
          const elapsed = Math.max(0, clientNow - phaseStartTimeRef.current)
          const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

          setTimeRemaining(revealRemaining)
          setIsRevealPhase(true)

          // Si le reveal est terminé, appeler handlePhaseEnd pour le mode solo
          if (
            revealRemaining <= 0.5 &&
            isSolo(gameMode) &&
            handlePhaseEndRef.current &&
            !gameEndedRef.current
          ) {
            handlePhaseEndRef.current()
          }
          return
        }

        // Si phaseStartTimeRef n'est pas encore défini, initialiser le chrono immédiatement
        // (fallback pour le mode solo ou si onRevealVideoStart n'a pas été appelé)
        if (phaseStartTimeRef.current === null) {
          phaseStartTimeRef.current = clientNow
          // S'assurer que gameDurationMsRef contient la durée de reveal
          const currentQuestion = gameQuestions[currentQuestionIndex]
          if (currentQuestion) {
            gameDurationMsRef.current =
              GameService.validateTimeLimit(currentQuestion.timeLimit) * 1000
          }
        }

        // Calculer le temps restant en utilisant phaseStartTimeRef
        const elapsed = Math.max(0, clientNow - phaseStartTimeRef.current)
        const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)
        setTimeRemaining(revealRemaining)
        setIsRevealPhase(true)

        // Si le reveal est terminé, appeler handlePhaseEnd pour le mode solo
        if (
          revealRemaining <= 0.5 &&
          isSolo(gameMode) &&
          handlePhaseEndRef.current &&
          !gameEndedRef.current
        ) {
          handlePhaseEndRef.current()
        }
        return
      }

      // Phase guess : calculer le temps écoulé depuis le début de la question
      // phaseStartTimeRef.current est maintenant un timestamp client (pas serveur)
      // donc on peut le comparer directement avec clientNow
      const elapsed = Math.max(0, clientNow - phaseStartTimeRef.current)
      const remaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

      if (
        remaining <= TIMING.COUNTDOWN_WARNING_THRESHOLD &&
        remaining > 0.5 &&
        !countdownWarningPlayedRef.current
      ) {
        countdownWarningPlayedRef.current = true
        soundManager.playClick()
      }
      if (remaining <= 0.5 && isSolo(gameMode) && !countdownEndPlayedRef.current) {
        countdownEndPlayedRef.current = true
        soundManager.playCountdownEnd()
      }

      setTimeRemaining(remaining)

      // isRevealPhase devient true seulement quand le temps de guess est complètement écoulé
      // On accepte aussi remaining <= 0.5 pour gérer les cas où le serveur passe à la question suivante
      // avant que le timer client ne soit complètement terminé (le serveur peut avoir un léger délai)
      const hasFullyElapsed = elapsed >= gameDurationMsRef.current || remaining <= 0.5
      const newIsRevealPhase =
        hasFullyElapsed && phaseStartTimeRef.current !== null && gameDurationMsRef.current !== null

      // En mode solo, définir revealStartTimeRef et phaseStartTimeRef dès que phase devient reveal
      // et mettre à jour gameDurationMsRef avec la durée de reveal
      if (newIsRevealPhase && phaseRef.current === 'guess' && isSolo(gameMode)) {
        if (revealStartTimeRef.current === null) {
          revealStartTimeRef.current = Date.now()
        }
        if (phaseStartTimeRef.current === null) {
          phaseStartTimeRef.current = Date.now()
          // Mettre à jour gameDurationMsRef avec la durée de reveal
          const currentQuestion = gameQuestions[currentQuestionIndex]
          if (currentQuestion) {
            gameDurationMsRef.current =
              GameService.validateTimeLimit(currentQuestion.timeLimit) * 1000
          }
        }
      }

      setIsRevealPhase(newIsRevealPhase)

      // Si le temps est écoulé, appeler handlePhaseEnd une seule fois (mode solo seulement, avant le reveal)
      if (
        newIsRevealPhase &&
        phaseRef.current === 'guess' &&
        isSolo(gameMode) &&
        !revealTimerStartedRef.current &&
        handlePhaseEndRef.current &&
        !gameEndedRef.current
      ) {
        handlePhaseEndRef.current()
      }
    }

    // Mettre à jour immédiatement
    updateTimer()

    // Programmer les mises à jour régulières
    // Ne démarrer le timer que s'il n'est pas déjà en cours
    if (timerIntervalRef.current === null) {
      timerIntervalRef.current = window.setInterval(updateTimer, 100)
    }
  }

  // Initialiser waitingForGo en mode multijoueur
  useEffect(() => {
    if (isOnline(gameMode)) {
      setWaitingForGo(true)
    } else {
      setWaitingForGo(false)
    }
  }, [gameMode])

  const handleRevealVideoStart = useCallback(() => {
    const now = Date.now()
    phaseStartTimeRef.current = now
    revealStartTimeRef.current = now

    const currentQuestion = gameQuestions[currentQuestionIndex]
    const revealDurationMs = GameService.validateTimeLimit(currentQuestion?.timeLimit) * 1000

    // Mettre à jour la durée pour le timer reveal
    gameDurationMsRef.current = revealDurationMs

    // Initialiser le temps restant avec la durée complète de reveal
    setTimeRemaining(revealDurationMs / 1000)

    // S'assurer que isRevealPhase est true pour que le timer utilise la logique reveal
    setIsRevealPhase(true)
  }, [gameQuestions, currentQuestionIndex])

  useEffect(() => {
    if (!isOnline(gameMode) || !roomCode) return

    // connectSocket est idempotent : réutilise le singleton (connecté ou en cours de connexion)
    const socket = connectSocket()

    const playerId = getPlayerId()
    // Room active : room:rejoin sera émis automatiquement à chaque reconnexion (utils/socket.ts)
    setCurrentRoom(roomCode)

    // Gérer beforeunload pour quitter proprement
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      leaveRoom()
      // Note: Les navigateurs modernes ignorent le message personnalisé
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Les handlers sont branchés même si le socket n'est pas encore connecté :
    // les emits ci-dessous sont mis en tampon par socket.io jusqu'à la connexion

    const handleRoomState = (state: any) => {
      if (state.players?.length) {
        setGamePlayers(state.players)
        const myPlayer = state.players.find((p: Player) => p.id === playerId)
        setIsHost(myPlayer?.isHost || false)
      }

      if (state.questions?.length) {
        setGameQuestions(state.questions)
        questionsRef.current = state.questions
      }

      if (state.game && state.phase === 'playing') {
        setGameStarted(true)
        // Ne pas réinitialiser showScore si la partie est terminée
        // (cela peut arriver si room:state est reçu après game:end)
        if (!gameEndedRef.current) {
          setShowScore(false)
        }

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
          setIsRevealPhase(false)
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
      players: updatedPlayers,
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
      // Ne pas réinitialiser showScore si la partie est terminée
      if (!gameEndedRef.current) {
        setShowScore(false)
      }

      if (updatedPlayers?.length) {
        setGamePlayers(updatedPlayers)
      }

      setWaitingForGo(true)
      mediaReadyRef.current = false
      setGameStep('loading')
      clearTimerInterval()

      // Réinitialiser le timer au démarrage de la partie
      setIsRevealPhase(false)
      setTimeRemaining(0) // Sera mis à jour quand le timer démarre
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
    }

    const handleGameGo = ({ durationMs }: { durationMs: number }) => {
      // Ne pas réinitialiser showScore si la partie est terminée
      if (gameEndedRef.current) {
        return
      }

      gameDurationMsRef.current = durationMs

      // Démarrer immédiatement (pas de synchronisation complexe)
      setWaitingForGo(false)
      setGameStep('playing')

      // Réinitialiser les états - le timer sera démarré dans handleMediaStart
      setIsRevealPhase(false)
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
      setTimeRemaining(0)

      // Fallback : si handleMediaStart n'est pas appelé dans les 3 secondes, démarrer le timer quand même
      const fallbackTimer = setTimeout(() => {
        if (
          mediaStartTimeRef.current === null &&
          gameDurationMsRef.current &&
          mediaReadyRef.current &&
          phaseStartTimeRef.current === null
        ) {
          console.warn('[Game] Fallback: onMediaStart pas appelé après 3s, démarrage du timer')
          const fallbackNow = Date.now()
          mediaStartTimeRef.current = fallbackNow
          startTimerCalculation(
            fallbackNow,
            gameDurationMsRef.current,
            fallbackNow,
            undefined,
            undefined
          )
          setTimeRemaining(gameDurationMsRef.current / 1000)
          setIsRevealPhase(false)
        }
      }, 3000)

      // Nettoyer le fallback si handleMediaStart est appelé
      const cleanupTimerRef = { current: null as NodeJS.Timeout | null }
      cleanupTimerRef.current = setInterval(() => {
        if (mediaStartTimeRef.current !== null || phaseStartTimeRef.current !== null) {
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

    const handleCorrectAnswer = ({
      playerId,
      players: updatedPlayers,
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
      questionIndex,
    }: {
      currentQuestion?: Question
      questions?: Question[]
      questionIndex: number
      durationMs?: number
    }) => {
      // Ne pas réinitialiser showScore si la partie est terminée
      // (cela peut arriver si game:next est reçu après game:end à cause d'un problème de timing)
      if (gameEndedRef.current) {
        return
      }

      if (serverQuestions?.length) {
        setGameQuestions(serverQuestions)
        questionsRef.current = serverQuestions
      }

      setCurrentQuestionIndex(questionIndex)
      questionAnsweredByRef.current = null
      isTransitioningRef.current = false
      setShowScore(false)
      setValidatedAnswers({}) // Réinitialiser les réponses validées pour la nouvelle question
      setPlayerAnswers({}) // Réinitialiser les réponses des joueurs pour la nouvelle question

      setWaitingForGo(true)
      mediaReadyRef.current = false
      revealStartTimeRef.current = null
      phaseStartTimeRef.current = null
      setGameStep('loading')
      clearTimerInterval()

      // Réinitialiser le timer pour la nouvelle question
      // Le timer sera démarré dans handleMediaStart quand le média commence vraiment à jouer
      setIsRevealPhase(false)
      setTimeRemaining(0) // Reste à 0 jusqu'à ce que le média démarre
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null

      // Réinitialiser les refs du timer pour éviter les valeurs résiduelles
      phaseStartTimeRef.current = null
      gameDurationMsRef.current = null

      // Réinitialiser les votes skip, les joueurs corrects, les réponses stockées et les joueurs ayant répondu pour la nouvelle question
      setSkipVotes(new Set())
      setCorrectPlayers(new Set())
      setAnsweredPlayers(new Set())
      strategy.clearAnswersForNextQuestion?.()

      // Réinitialiser le debounce pour permettre le skip sur la nouvelle question
      lastSkipVoteTimeRef.current = 0

      // Forcer le re-render pour réinitialiser revealStartedRef dans VideoPlayer
      // En changeant la clé du composant QuestionCard, on force sa réinitialisation complète
    }

    const handleGameEnded = ({ players: finalPlayers }: { players: Player[] }) => {
      // Marquer que la partie est terminée AVANT tout autre changement d'état
      gameEndedRef.current = true

      // S'assurer que le timer est arrêté avant de changer l'état
      clearTimerInterval()

      // Mettre à jour les joueurs
      setGamePlayers(finalPlayers)

      // Réinitialiser le debounce
      lastSkipVoteTimeRef.current = 0

      // Utiliser un setTimeout pour s'assurer que showScore est mis à true après tous les autres setters
      // et après que tous les autres useEffect/handlers aient fini
      setTimeout(() => {
        if (gameEndedRef.current) {
          setShowScore(true)
        }
      }, 200)
    }

    const handleError = ({ code, message }: { code: string; message: string }) => {
      // Si le joueur n'est pas trouvé dans la room, essayer de rejoindre avec room:join
      if (code === 'PLAYER_NOT_FOUND' && roomCode) {
        // Essayer de rejoindre la room avec room:join (peut-être que le joueur n'a jamais rejoint)
        socket.emit('room:join', {
          roomCode,
          playerId,
          playerName: 'Joueur', // Nom par défaut
        })
        return
      }

      // Pour les erreurs critiques, afficher un message à l'utilisateur
      if (code !== 'GAME_ALREADY_STARTED') {
        console.error('[Game] Erreur serveur:', { code, message })

        // Erreurs critiques qui nécessitent un message utilisateur
        const criticalErrors = ['ROOM_NOT_FOUND', 'ROOM_FULL', 'GAME_ERROR', 'NETWORK_ERROR']
        if (criticalErrors.includes(code)) {
          toast.error(`Erreur: ${message || 'Une erreur est survenue'}`)
        }
      }
    }

    // Écouter tous les événements
    const handleGameSync = ({
      durationMs,
      questionIndex,
    }: {
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
      setIsRevealPhase(false)
      setTimeRemaining(0) // Sera mis à jour dans handleMediaStart
    }

    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('game:go', handleGameGo)
    socket.on('game:sync', handleGameSync)
    socket.on('game:next', handleNextQuestion)

    const handleGameReveal = ({ durationMs }: { questionIndex?: number; durationMs?: number }) => {
      // Arrêter le timer existant pour le redémarrer avec la logique de reveal
      clearTimerInterval()

      // Jouer le son de révélation
      soundManager.playReveal()

      // Initialiser le timer du reveal
      const now = Date.now()
      phaseStartTimeRef.current = now
      revealStartTimeRef.current = now

      // Utiliser la durée du serveur si disponible, sinon celle de la question, sinon la valeur par défaut
      const currentQuestion = gameQuestions[currentQuestionIndex]
      const revealDurationMs =
        durationMs || GameService.validateTimeLimit(currentQuestion?.timeLimit) * 1000
      gameDurationMsRef.current = revealDurationMs

      // Mettre à jour le temps restant pour le reveal
      setTimeRemaining(revealDurationMs / 1000)
      setIsRevealPhase(true)

      // Réinitialiser les votes skip pour la phase reveal
      setSkipVotes(new Set())

      // Redémarrer le timer avec la logique de reveal
      const updateRevealTimer = () => {
        if (gameEndedRef.current) {
          return
        }

        if (gameDurationMsRef.current === null || phaseStartTimeRef.current === null) {
          return
        }

        const clientNow = Date.now()
        const elapsed = Math.max(0, clientNow - phaseStartTimeRef.current)
        const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

        setTimeRemaining(revealRemaining)
        setIsRevealPhase(true)

        // Si le reveal est terminé, le serveur devrait envoyer game:next
        if (revealRemaining <= 0.1) {
          setTimeRemaining(0)
          setIsRevealPhase(true)
        }
      }

      // Mettre à jour immédiatement
      updateRevealTimer()

      // Démarrer le timer
      timerIntervalRef.current = window.setInterval(updateRevealTimer, 100)
    }
    socket.on('game:reveal', handleGameReveal)

    const handleAnswersValidated = ({
      validatedAnswers: validated,
      correctPlayers: correctPlayerIds,
      players,
      playerAnswers: playerAnswersData,
    }: {
      validatedAnswers: Record<string, boolean>
      correctPlayers: string[]
      players: Player[]
      playerAnswers?: Record<string, string> // Réponses des joueurs
    }) => {
      // Mettre à jour les scores des joueurs
      setGamePlayers(players)

      // Stocker les joueurs corrects pour le surlignage vert
      setCorrectPlayers(new Set(correctPlayerIds))

      // Stocker les réponses validées pour savoir si le joueur actuel a répondu correctement
      setValidatedAnswers(validated)

      // Stocker les réponses des joueurs pour l'affichage
      if (playerAnswersData) {
        setPlayerAnswers(playerAnswersData)
      }
    }
    socket.on('game:answers-validated', handleAnswersValidated)

    const handleSkipVoteUpdated = ({
      playerId,
      skipVotes: votes,
      allPlayersVoted,
    }: {
      playerId: string
      skipVotes: string[]
      allPlayersVoted: boolean
    }) => {
      setSkipVotes(new Set(votes))
    }
    socket.on('game:skip-vote-updated', handleSkipVoteUpdated)

    const handleAnswerStored = ({ playerId }: { playerId: string }) => {
      // Ajouter le joueur à la liste des joueurs ayant répondu
      setAnsweredPlayers((prev) => new Set([...prev, playerId]))
    }
    socket.on('game:answer-stored', handleAnswerStored)

    socket.on('game:correct-answer', handleCorrectAnswer)
    socket.on('game:end', handleGameEnded)

    socket.on('error', handleError)

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
          playerName: 'Joueur', // Nom par défaut si on n'a pas le nom
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
      socket.off('game:reveal', handleGameReveal)
      socket.off('game:answers-validated', handleAnswersValidated)
      socket.off('game:skip-vote-updated', handleSkipVoteUpdated)
      socket.off('game:answer-stored', handleAnswerStored)
      socket.off('game:correct-answer', handleCorrectAnswer)
      socket.off('game:end', handleGameEnded)
      socket.off('error', handleError)
      socket.off('room:joined', handleRoomJoinedOrRejoined)
      socket.off('room:rejoined', handleRoomJoinedOrRejoined)
      clearTimeout(joinTimeout)
      clearCurrentRoom(roomCode)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      clearTimerInterval()
      timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId))
      timeoutRefs.current = []
    }
  }, [gameMode, roomCode])

  // Le host est maintenant déterminé depuis room:state

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId))
    }
  }, [])


  const handleAnswer = (answer: string, _timeRemaining: number, _playerId?: string) => {
    if (showScore) return
    if (isTransitioningRef.current) return

    strategy.submitAnswer(answer)
  }

  const validateAnswers = useCallback(() => {
    strategy.validateAnswers({
      gameQuestions,
      currentQuestionIndex,
      soloAnswersRef,
      setScore,
      setCorrectPlayers,
    })
  }, [strategy, gameQuestions, currentQuestionIndex])

  const handleSkipVote = useCallback(() => {
    const now = Date.now()

    if (now - lastSkipVoteTimeRef.current < 500) return
    if (gameEndedRef.current) return
    if (!isSolo(gameMode) && (!mediaReadyRef.current || waitingForGo)) return

    const playerId = strategy.getPlayerId()
    if (skipVotes.has(playerId)) return

    // Mettre à jour le timestamp du dernier clic
    lastSkipVoteTimeRef.current = now

    if (isOnline(gameMode) && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:skip-vote', { roomCode })
      }
    } else {
      // En mode solo, skip = handlePhaseEnd (même logique que timer à 0)
      if (handlePhaseEndRef.current) {
        handlePhaseEndRef.current()
      }
      setSkipVotes(new Set())
    }
  }, [strategy, roomCode, waitingForGo, skipVotes])

  const handlePhaseEnd = () => {
    if (showScore) return
    if (isTransitioningRef.current) return
    if (gameEndedRef.current) return // Ne pas continuer si la partie est terminée

    // Jouer le son de transition guess → reveal
    if (phaseRef.current === 'guess') {
      soundManager.playReveal()
    }

    if (isSolo(gameMode)) {
      // En mode solo, valider les réponses à la fin du guess
      if (phaseRef.current === 'guess') {
        // Phase guess : valider les réponses avant de passer en phase reveal
        validateAnswers()
        // Initialiser les refs du timer reveal pour que updateTimer puisse continuer
        const revealNow = Date.now()
        phaseStartTimeRef.current = revealNow
        revealStartTimeRef.current = revealNow
        const currentQuestion = gameQuestions[currentQuestionIndex]
        if (currentQuestion) {
          gameDurationMsRef.current =
            GameService.validateTimeLimit(currentQuestion.timeLimit) * 1000
        }
        setTimeRemaining((gameDurationMsRef.current ?? 0) / 1000)
        setPhase('reveal')
        phaseRef.current = 'reveal'
        countdownWarningPlayedRef.current = false
        countdownEndPlayedRef.current = false
        return // Ne pas passer à la question suivante, juste passer au reveal
      }

      // Phase reveal : passer à la question suivante
      isTransitioningRef.current = true
      questionAnsweredByRef.current = null
      setPlayerAnswers({}) // Réinitialiser les réponses pour la nouvelle question

      const timeoutId = window.setTimeout(() => {
        phaseStartTimeRef.current = null
        gameDurationMsRef.current = null
        revealStartTimeRef.current = null
        phaseStartTimeRef.current = null

        setCurrentQuestionIndex((prev) => {
          const totalQuestions = questionsRef.current.length
          if (GameService.canGoToNextQuestion(prev, totalQuestions)) {
            isTransitioningRef.current = false
            return prev + 1
          } else {
            // Partie terminée en mode solo
            gameEndedRef.current = true
            clearTimerInterval() // Arrêter le timer
            isTransitioningRef.current = false
            // Utiliser timeoutRefs pour nettoyer ce timeout aussi
            const showScoreTimeoutId = window.setTimeout(
              () => setShowScore(true),
              TIMING.REVEAL_DELAY
            )
            timeoutRefs.current.push(showScoreTimeoutId)
            return prev
          }
        })
      }, TIMING.REVEAL_DELAY)
      timeoutRefs.current.push(timeoutId)
    } else if (isOnline(gameMode)) {
      // En mode multijoueur, le serveur gère le timer et décide quand passer à la question suivante
      // Le serveur enverra game:next quand le timer expire
      questionAnsweredByRef.current = null
    }
  }

  // Mettre à jour la ref pour que startTimerCalculation puisse l'utiliser
  useEffect(() => {
    handlePhaseEndRef.current = handlePhaseEnd
  }, [handlePhaseEnd])

  const handleScoreSoundPlayed = useCallback(() => {
    successSoundPlayedRef.current = true
  }, [])

  const handleRestart = () => {
    resetGameState()
    gameInstanceKeyRef.current += 1

    if (isOnline(gameMode) && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:restart', { roomCode })
        setGameStarted(false)
      }
    }
  }

  const handleModifySettings = () => {
    setShowScore(false)
    setShowSettingsPopup(true)
  }

  const handleSettingsSaved = (
    newCategories: Category[],
    newQuestions: Question[],
    timeLimit: number,
    questionCount: number
  ) => {
    setShowSettingsPopup(false)
    setShowScore(false)
    setCurrentQuestionIndex(0)
    setScore(0)
    questionAnsweredByRef.current = null
    isTransitioningRef.current = false

    if (isOnline(gameMode) && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:restart-with-categories', {
          roomCode,
          questions: newQuestions,
          categories: newCategories,
          defaultTimeLimit: timeLimit,
          questionCount: questionCount,
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
  if (isOnline(gameMode)) {
    if (!gameStarted) {
      return (
        <LoadingScreen
          message="En attente du démarrage..."
          subMessage="L'hôte va démarrer la partie."
          showSpinner={true}
        />
      )
    }

    // Si la partie a démarré mais pas encore de questions, attendre
    if (gameQuestions.length === 0) {
      return (
        <LoadingScreen
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
        <LoadingScreen
          message="Aucune question disponible pour les catégories sélectionnées."
          showSpinner={false}
          onBack={onEndGame}
        />
      )
    }
  }

  if (currentQuestionIndex < 0 || currentQuestionIndex >= gameQuestions.length) {
    return (
      <LoadingScreen
        message="Erreur : Index de question invalide."
        showSpinner={false}
        onBack={onEndGame}
      />
    )
  }

  const currentQuestion = gameQuestions[currentQuestionIndex]

  if (!currentQuestion) {
    return (
      <LoadingScreen
        message="Erreur : Question introuvable."
        showSpinner={false}
        onBack={onEndGame}
      />
    )
  }

  const inviteLink =
    typeof window !== 'undefined' && isOnline(gameMode) && roomCode
      ? `${window.location.origin}/?room=${roomCode}`
      : null

  return (
    <div className={gameStyles.gameScreen} data-testid="game-screen">
      <GameTopBar
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={gameQuestions.length}
        currentQuestion={currentQuestion}
        timeRemaining={timeRemaining}
        isRevealPhase={isRevealPhase}
        score={strategy.getDisplayScore(score, gamePlayers)}
        inviteLink={inviteLink}
        onQuit={() => {
          leaveRoom()
          onEndGame()
        }}
        onSettings={() => setShowSettingsPopup(true)}
        isGameEnded={showScore}
      />

      {/* Main: Zone media/waveform centrée */}
      <div className={gameStyles.gameMain} data-testid="game-main">
        <div
          className={`${gameStyles.gameInterfaceBody} ${!isOnline(gameMode) ? gameStyles.gameInterfaceBodyNoSidebar : ''} ${showScore && isSolo(gameMode) ? gameStyles.gameInterfaceBodySoloEnd : ''}`}
          id="game-interface-body"
        >
          {showScore ? (
            <EndScreen
              score={strategy.getDisplayScore(score, gamePlayers)}
              totalQuestions={gameQuestions.length}
              gameMode={gameMode}
              players={gamePlayers}
              isHost={isHost}
              shouldPlaySound={!successSoundPlayedRef.current}
              onRestart={handleRestart}
              onModifySettings={handleModifySettings}
              onQuit={onEndGame}
              onSoundPlayed={handleScoreSoundPlayed}
            />
          ) : (
            <RoundScreen
              question={currentQuestion}
              instanceKey={gameInstanceKeyRef.current}
              currentQuestionIndex={currentQuestionIndex}
              gameMode={gameMode}
              players={gamePlayers}
              questionAnsweredBy={questionAnsweredByRef.current}
              timeRemaining={timeRemaining}
              isRevealPhase={isRevealPhase}
              skipVotes={skipVotes}
              correctPlayers={correctPlayers}
              answeredPlayers={answeredPlayers}
              playerAnswers={playerAnswers}
              validatedAnswers={validatedAnswers}
              allQuestions={gameQuestions}
              waitingForGo={waitingForGo}
              gameStep={gameStep}
              showSettingsPopup={showSettingsPopup}
              isGameEnded={gameEndedRef.current}
              isMediaReady={isSolo(gameMode) || (mediaReadyRef.current && !waitingForGo)}
              revealStartTime={
                isOnline(gameMode) ? revealStartTimeRef.current || undefined : undefined
              }
              onAnswer={handleAnswer}
              onPhaseEnd={handlePhaseEnd}
              onSkipVote={handleSkipVote}
              onMediaReady={isOnline(gameMode) ? handleMediaReady : undefined}
              onMediaStart={handleMediaStart}
              onRevealVideoStart={handleRevealVideoStart}
            />
          )}
        </div>
      </div>

      {/* Dialog uniquement pour les paramètres */}
      <Dialog.Root
        open={showSettingsPopup}
        onOpenChange={(open) => {
          if (!open) {
            setShowSettingsPopup(false)
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={gameStyles.gameModalOverlay} />
          <Dialog.Content
            className={gameStyles.gameModalContent}
            onEscapeKeyDown={() => {
              setShowSettingsPopup(false)
            }}
          >
            <Dialog.Title style={{ display: 'none' }}>Game Settings</Dialog.Title>
            <Dialog.Description style={{ display: 'none' }}>Game settings</Dialog.Description>
            <GameSettingsPopup
              isOpen={true}
              currentCategories={categories}
              currentTimeLimit={getCurrentTimeLimit()}
              currentQuestionCount={gameQuestions.length}
              onSave={handleSettingsSaved}
              onClose={() => {
                setShowSettingsPopup(false)
              }}
              gameMode={gameMode}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
