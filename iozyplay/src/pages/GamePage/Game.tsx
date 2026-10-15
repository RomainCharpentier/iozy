import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import GameSettingsPopup from '@/pages/GamePage/settings/GameSettingsPopup'
import GameTopBar from '@/pages/GamePage/ui/GameTopBar'
import RoundScreen from '@/pages/GamePage/ui/RoundScreen'
import EndScreen from '@/pages/GamePage/ui/EndScreen'
import LoadingScreen from '@/pages/GamePage/ui/LoadingScreen'
import QuitGameDialog from '@/pages/GamePage/ui/QuitGameDialog'
import GameAnnouncer from '@/pages/GamePage/ui/GameAnnouncer'
import type { PlayerResult } from '@/pages/GamePage/ui/GameAnnouncer'
import { useRoomCategories } from '@/pages/GamePage/settings/useRoomCategories'
import { useMediaMuted } from '@/hooks/useMediaMuted'
import { useAnswerSuggestions } from '@/pages/GamePage/question/useAnswerSuggestions'
import type { Category, Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo, isOnline } from '@/lib/game/gameMode'
import { getGameModeStrategy } from '@/lib/game/strategies'
import { getSocket, connectSocket, setCurrentRoom, clearCurrentRoom } from '@/utils/socket'
import { getPlayerId } from '@/utils/playerId'
import { getSessionToken, setSessionToken } from '@/utils/sessionToken'
import { getLocalPlayerAvatar } from '@/utils/playerAvatar'
import { getSavedUsername, pickPlayerName } from '@/utils/playerName'
import { GameService, TIMING } from '@/services/gameService'
import { toast } from 'sonner'
import { soundManager } from '@/utils/sounds'
import * as Dialog from '@radix-ui/react-dialog'
import { MotionConfig } from 'motion/react'

// Marge appliquée à l'échéance reçue par game:sync : le champ se fige un peu avant la
// validation serveur plutôt qu'après (la dernière saisie part au gel du champ)
const SYNC_DEADLINE_MARGIN_MS = 300

interface GameProps {
  questions: Question[]
  categories: Category[]
  gameMode: GameMode
  players: Player[]
  roomCode?: string | null
  /** Nom choisi avant /game (lobby) : repli si le serveur ne connaît plus le joueur */
  playerName?: string
  onEndGame: () => void
  onRestartWithNewCategories?: (categories: Category[], questions: Question[]) => void
}

export default function Game({
  questions,
  categories,
  gameMode,
  players,
  roomCode,
  playerName,
  onEndGame,
  onRestartWithNewCategories,
}: GameProps) {
  const soloAnswersRef = useRef<string[]>([])

  const strategy = useMemo(
    () =>
      getGameModeStrategy(
        gameMode,
        isSolo(gameMode) ? { soloAnswersRef } : { roomCode: roomCode ?? null }
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
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [mediaMuted, toggleMediaMuted] = useMediaMuted()
  // Thèmes du salon (suivis via room:state) pour pré-remplir « Changer les thèmes »
  const settingsCategories = useRoomCategories(isOnline(gameMode) ? roomCode : null, categories)
  const [gameQuestions, setGameQuestions] = useState<Question[]>(() =>
    strategy.getInitialQuestions(questions)
  )
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [phase, setPhase] = useState<'guess' | 'reveal'>('guess')
  const phaseRef = useRef<'guess' | 'reveal'>('guess')
  const isRevealPhase = phase === 'reveal'
  // Index courant lisible par les handlers socket (pas de closure figée)
  const currentQuestionIndexRef = useRef(0)
  currentQuestionIndexRef.current = currentQuestionIndex
  const setQuestionIndex = (index: number) => {
    currentQuestionIndexRef.current = index
    setCurrentQuestionIndex(index)
  }
  // En ligne : index de la dernière question dont le serveur a validé les réponses
  // (game:answers-validated, game:reveal ou room:state après reconnexion)
  const validatedQuestionIndexRef = useRef<number | null>(null)
  const setIsRevealPhase = (v: boolean) => {
    // Une question validée par le serveur reste en reveal : un room:state, un game:sync ou
    // un tick de chrono ne doit jamais rendre le champ à nouveau modifiable (réponses figées).
    if (
      !v &&
      validatedQuestionIndexRef.current !== null &&
      validatedQuestionIndexRef.current === currentQuestionIndexRef.current
    ) {
      return
    }
    const p = v ? 'reveal' : 'guess'
    setPhase(p)
    phaseRef.current = p
  }
  const questionsRef = useRef<Question[]>(strategy.getInitialQuestions(questions))
  const timeoutRefs = useRef<number[]>([])
  const revealTimerStartedRef = useRef<boolean>(false) // Éviter double démarrage du timer reveal
  const mediaStartTimeRef = useRef<number | null>(null) // Timestamp quand le média commence vraiment à jouer
  const isTransitioningRef = useRef(false)
  const timerIntervalRef = useRef<number | null>(null)
  // Dernier calcul du chrono : relancé au retour au premier plan (intervalles ralentis en fond)
  const timerTickRef = useRef<(() => void) | null>(null)
  // game:sync (reconnexion / arrivée en cours de question) : échéance locale du guess
  const syncedDeadlineRef = useRef<{ questionIndex: number; deadline: number } | null>(null)
  // Réponse du joueur pour la question en cours (contenu du champ transmis) et accusés
  // game:answer-stored : « en cours d'envoi » tant que tous les envois ne sont pas confirmés
  const lastAnswerRef = useRef<string | null>(null)
  const answerSyncRef = useRef({ sent: 0, acked: 0 })
  const [answerAckPending, setAnswerAckPending] = useState(false)
  const [connectionLost, setConnectionLost] = useState(false)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const phaseStartTimeRef = useRef<number | null>(null) // Timestamp du début de la phase actuelle (guess ou reveal)
  const gameDurationMsRef = useRef<number | null>(null)
  const revealStartTimeRef = useRef<number | null>(null) // Pour sync serveur (multi)
  const gameEndedRef = useRef<boolean>(false)
  const successSoundPlayedRef = useRef<boolean>(false) // Pour éviter que le son de fin joue plusieurs fois
  const lastSkipVoteTimeRef = useRef<number>(0) // Pour le debounce
  const [waitingForGo, setWaitingForGo] = useState<boolean>(strategy.getInitialWaitingForGo())
  const mediaReadyRef = useRef<boolean>(false) // Indique si le média est préchargé
  const [gameStep, setGameStep] = useState<string>('loading') // Étape actuelle: loading, ready, starting, playing
  const gameStepRef = useRef('loading')
  gameStepRef.current = gameStep
  const handlePhaseEndRef = useRef<(() => void) | null>(null) // Référence à handlePhaseEnd pour l'utiliser dans startTimerCalculation
  const [skipVotes, setSkipVotes] = useState<Set<string>>(new Set()) // Joueurs qui ont voté skip
  const [correctPlayers, setCorrectPlayers] = useState<Set<string>>(new Set()) // Joueurs qui ont répondu correctement (pour surlignage vert)
  const [answeredPlayers, setAnsweredPlayers] = useState<Set<string>>(new Set()) // Joueurs ayant soumis pendant la phase guess
  const [validatedAnswers, setValidatedAnswers] = useState<Record<string, boolean>>({}) // Réponses validées par le serveur (mode multijoueur)
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, string>>({}) // Réponses des joueurs
  // Bonne réponse envoyée par le serveur au reveal, associée à l'index de sa question
  // (les handlers socket ne lisent pas currentQuestionIndex : pas de closure figée)
  const [revealedAnswer, setRevealedAnswer] = useState<{
    questionIndex: number
    answer: string
  } | null>(null)
  const answerSuggestions = useAnswerSuggestions(gameQuestions)

  const previousQuestionsRef = useRef<string>('')
  const gameInstanceKeyRef = useRef<number>(0)
  const countdownWarningPlayedRef = useRef<boolean>(false)
  const countdownEndPlayedRef = useRef<boolean>(false)
  // Dernier nom connu du joueur local (lu par les handlers socket : ref, pas de closure figée).
  // Priorité au nom vu dans room:state (source de vérité serveur), puis au nom du lobby.
  const myNameRef = useRef<string | undefined>(
    pickPlayerName(players.find((p) => p.id === getPlayerId())?.name, playerName)
  )
  useEffect(() => {
    if (!myNameRef.current) myNameRef.current = pickPlayerName(playerName)
  }, [playerName])

  useEffect(() => {
    strategy.onMount?.()
  }, [strategy])

  // Suivi de la réponse : à remettre à zéro à chaque nouvelle question (refs + setter stables,
  // utilisable depuis les handlers socket)
  const resetAnswerTracking = () => {
    lastAnswerRef.current = null
    answerSyncRef.current = { sent: 0, acked: 0 }
    setAnswerAckPending(false)
  }

  const resetGameState = useCallback(() => {
    setQuestionIndex(0)
    validatedQuestionIndexRef.current = null
    syncedDeadlineRef.current = null
    resetAnswerTracking()
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
    setRevealedAnswer(null)

    gameEndedRef.current = false
    successSoundPlayedRef.current = false
    isTransitioningRef.current = false
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
  // Version courante pour les handlers socket (leur effet n'est pas relancé à chaque rendu)
  const resetGameStateRef = useRef(resetGameState)
  resetGameStateRef.current = resetGameState

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
  }, [gameQuestions, resetGameState])

  useEffect(() => {
    // En mode solo, utiliser les questions des props
    if (isSolo(gameMode) && questions.length > 0) {
      const questionsKey = JSON.stringify(questions.map((q) => q.id || q.mediaUrl))
      if (gameQuestions.length === 0 || previousQuestionsRef.current !== questionsKey) {
        setGameQuestions(strategy.getInitialQuestions(questions))
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

    // Question en cours lors d'une reconnexion / arrivée tardive : le chrono part du temps
    // restant annoncé par game:sync, pas de la durée complète
    let startedAt = now
    const synced = syncedDeadlineRef.current
    if (isOnline(gameMode) && synced && synced.questionIndex === currentQuestionIndexRef.current) {
      startedAt = synced.deadline - durationMs
    }

    setIsRevealPhase(false)
    revealTimerStartedRef.current = false
    countdownWarningPlayedRef.current = false
    countdownEndPlayedRef.current = false

    // Initialiser le temps restant correctement AVANT de démarrer le timer
    const initialRemaining = Math.max(0, (startedAt + durationMs - now) / 1000)
    setTimeRemaining(initialRemaining)

    // Démarrer le timer maintenant que le média joue vraiment
    // Utiliser la même logique pour les deux modes
    startTimerCalculation(startedAt, durationMs, now, undefined, undefined)
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
      timerTickRef.current = updateTimer
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
      // Son de fin de chrono : seul effet de bord ici (pas de transition de phase),
      // donc sans risque à jouer aussi en ligne. Le passage de phase lui-même reste
      // piloté par le serveur en ligne (cf. le `isSolo` plus haut sur handlePhaseEndRef).
      if (remaining <= 0.5 && !countdownEndPlayedRef.current) {
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

      // Solo : fin du chrono = fin du guess. handlePhaseEnd valide la réponse (contenu du
      // champ) PUIS passe au reveal. Il doit être appelé tant que la phase est encore
      // « guess » : basculer la phase avant (comme auparavant) lui faisait sauter la
      // validation et le reveal.
      if (newIsRevealPhase && phaseRef.current === 'guess' && isSolo(gameMode)) {
        if (handlePhaseEndRef.current && !gameEndedRef.current) {
          handlePhaseEndRef.current()
        }
        return
      }

      setIsRevealPhase(newIsRevealPhase)
    }

    // Mettre à jour immédiatement
    updateTimer()
    timerTickRef.current = updateTimer

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

    // Remise à zéro propre à une question (nouvelle question, ou question manquée pendant
    // une coupure : game:start reçu avec un autre index)
    const resetQuestionState = () => {
      isTransitioningRef.current = false
      setShowScore(false)
      setValidatedAnswers({})
      setPlayerAnswers({})
      setWaitingForGo(true)
      mediaReadyRef.current = false
      setGameStep('loading')
      clearTimerInterval()
      setIsRevealPhase(false)
      setTimeRemaining(0) // Reste à 0 jusqu'à ce que le média démarre
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
      // Réinitialiser les refs du timer pour éviter les valeurs résiduelles
      revealStartTimeRef.current = null
      phaseStartTimeRef.current = null
      gameDurationMsRef.current = null
      setSkipVotes(new Set())
      setCorrectPlayers(new Set())
      setAnsweredPlayers(new Set())
      strategy.clearAnswersForNextQuestion?.()
      resetAnswerTracking()
      // Réinitialiser le debounce pour permettre le skip sur la nouvelle question
      lastSkipVoteTimeRef.current = 0
    }

    // Une question a été validée par le serveur : phase reveal définitive pour elle
    const markQuestionValidated = (questionIndex: number) => {
      validatedQuestionIndexRef.current = questionIndex
      if (questionIndex === currentQuestionIndexRef.current) {
        setIsRevealPhase(true)
      }
    }

    const handleRoomState = (state: any) => {
      if (state.players?.length) {
        setGamePlayers(state.players)
        const myPlayer = state.players.find((p: Player) => p.id === playerId)
        setIsHost(myPlayer?.isHost || false)
        myNameRef.current = pickPlayerName(myPlayer?.name, myNameRef.current)
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
        const questionIndex: number | undefined = state.game.questionIndex
        // room:state est diffusé à chaque arrivée/départ/reconnexion d'un joueur : s'il
        // décrit la question déjà en cours de lecture ici, ne rien réinitialiser (sinon le
        // chrono repassait à 0 et le champ redevenait modifiable pendant le reveal).
        const alreadyPlayingThisQuestion =
          gameStepRef.current === 'playing' &&
          newGameStep === 'playing' &&
          (questionIndex === undefined || questionIndex === currentQuestionIndexRef.current)

        setGameStep(newGameStep)

        if (questionIndex !== undefined && questionIndex !== currentQuestionIndexRef.current) {
          // Question différente (arrivée en cours de partie, game:next manqué pendant une
          // coupure) : repartir d'un état de question vierge
          setQuestionIndex(questionIndex)
          if (!gameEndedRef.current) resetQuestionState()
        }

        // Réponse présente seulement après validation (reconnexion pendant le reveal)
        if (
          typeof state.game.correctAnswer === 'string' &&
          state.game.questionIndex !== undefined
        ) {
          setRevealedAnswer({
            questionIndex: state.game.questionIndex,
            answer: state.game.correctAnswer,
          })
        }

        // Réponses déjà validées (reconnexion pendant le reveal) : rester figé en reveal
        if (state.game.validatedAnswers?._validated === true && questionIndex !== undefined) {
          const { _validated, ...validated } = state.game.validatedAnswers
          if (questionIndex === currentQuestionIndexRef.current) {
            setValidatedAnswers(validated)
          }
          markQuestionValidated(questionIndex)
        }

        if (alreadyPlayingThisQuestion) {
          return
        }

        // Stocker durationMs pour que handleMediaStart puisse l'utiliser
        if (state.game.durationMs && phaseStartTimeRef.current === null) {
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
      // Un game:start reçu après la fin d'une partie est forcément une nouvelle partie
      // (« Rejouer » / « Changer les thèmes » de l'hôte). Ne pas compter sur un changement
      // de la liste des questions : le nouveau tirage peut être identique à l'ancien.
      if (gameEndedRef.current) {
        resetGameStateRef.current()
        gameInstanceKeyRef.current += 1
      }

      if (serverQuestions?.length) {
        setGameQuestions(serverQuestions)
        questionsRef.current = serverQuestions
      } else {
        console.error('[Game] handleGameStarted: Aucune question reçue!')
      }

      if (updatedPlayers?.length) {
        setGamePlayers(updatedPlayers)
      }

      // Resynchronisation (room:rejoin après une coupure) sur la question déjà en cours :
      // garder le chrono, la phase et la saisie ; game:sync réalignera le temps restant.
      const isResync =
        questionIndex === currentQuestionIndexRef.current &&
        (phaseStartTimeRef.current !== null ||
          mediaStartTimeRef.current !== null ||
          phaseRef.current === 'reveal')
      if (isResync) {
        setGameStarted(true)
        return
      }

      setQuestionIndex(questionIndex)
      setGameStarted(true)
      // Nouvelle partie, arrivée en cours de partie ou question manquée pendant une coupure
      resetQuestionState()
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

      setQuestionIndex(questionIndex)
      // Le composant QuestionCard est remonté (clé = index) : saisie et envoi en attente
      // de la question précédente sont abandonnés
      resetQuestionState()
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

    // Repli room:join (joueur inconnu du serveur ou room:rejoin sans réponse), émis une seule fois.
    // Toujours avec le vrai nom : sans nom connu, on n'en envoie pas (le serveur garde le nom
    // d'un joueur existant et n'applique son défaut qu'à un nouveau joueur).
    let joinFallbackSent = false
    const emitJoinFallback = () => {
      if (joinFallbackSent) return
      joinFallbackSent = true
      socket.emit('room:join', {
        roomCode,
        playerId,
        playerName: pickPlayerName(myNameRef.current, getSavedUsername()),
        playerAvatar: getLocalPlayerAvatar(),
        sessionToken: getSessionToken(roomCode),
      })
    }

    const handleError = ({ code, message }: { code: string; message: string }) => {
      // Si le joueur n'est pas trouvé dans la room, essayer de rejoindre avec room:join
      if (code === 'PLAYER_NOT_FOUND' && roomCode) {
        emitJoinFallback()
        return
      }

      // Pour les erreurs critiques, afficher un message à l'utilisateur
      if (code !== 'GAME_ALREADY_STARTED') {
        console.error('[Game] Erreur serveur:', { code, message })

        // Erreurs critiques qui nécessitent un message utilisateur
        const criticalErrors = [
          'ROOM_NOT_FOUND',
          'ROOM_FULL',
          'GAME_ERROR',
          'NETWORK_ERROR',
          'INVALID_SESSION',
        ]
        if (code === 'ROOM_NOT_FOUND' || code === 'INVALID_SESSION') {
          // Plus rien n'arrivera pour ce salon (serveur redémarré, salon fermé) :
          // écran explicite avec retour à l'accueil plutôt qu'une attente infinie
          clearTimerInterval()
          setFatalError(
            code === 'ROOM_NOT_FOUND'
              ? 'Ce salon n’existe plus : il a été fermé ou le serveur a redémarré.'
              : 'Impossible de reprendre votre place dans ce salon.'
          )
          return
        }
        if (criticalErrors.includes(code)) {
          toast.error(message || 'Une erreur est survenue')
        }
      }
    }

    // Écouter tous les événements
    const handleGameSync = ({
      durationMs,
      questionIndex,
      timeRemainingMs,
    }: {
      startedAt: number
      durationMs: number
      timeRemainingMs: number
      serverTime: number
      questionIndex: number
    }) => {
      // Synchronisation d'un joueur qui (re)joint une question en cours. Le temps restant
      // du serveur fixe l'échéance locale (marge : mieux vaut figer le champ un peu avant
      // la validation serveur qu'après, pour que la dernière saisie soit bien prise).
      const now = Date.now()
      const deadline = now + Math.max(0, timeRemainingMs - SYNC_DEADLINE_MARGIN_MS)
      syncedDeadlineRef.current = { questionIndex, deadline }
      setWaitingForGo(false)
      setGameStep('playing')
      setQuestionIndex(questionIndex)

      if (timeRemainingMs <= 0) {
        // Guess terminé côté serveur : le champ reste figé (reveal), sans chrono à relancer
        setIsRevealPhase(true)
        if (phaseRef.current === 'reveal' && timerIntervalRef.current === null) {
          setTimeRemaining(0)
        }
        return
      }

      if (phaseRef.current === 'guess' && phaseStartTimeRef.current !== null) {
        // Chrono déjà lancé (resynchronisation après coupure) : le réaligner sur le serveur
        phaseStartTimeRef.current = deadline - durationMs
        gameDurationMsRef.current = durationMs
        timerTickRef.current?.()
        return
      }

      // Sinon, le chrono démarrera avec le média (handleMediaStart lit syncedDeadlineRef)
      gameDurationMsRef.current = durationMs
      setIsRevealPhase(false)
      setTimeRemaining(Math.max(0, (deadline - now) / 1000))
    }

    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('game:go', handleGameGo)
    socket.on('game:sync', handleGameSync)
    socket.on('game:next', handleNextQuestion)

    const handleGameReveal = ({
      durationMs,
      questionIndex,
      correctAnswer,
    }: {
      questionIndex?: number
      durationMs?: number
      correctAnswer?: string
    }) => {
      if (typeof correctAnswer === 'string' && questionIndex !== undefined) {
        setRevealedAnswer({ questionIndex, answer: correctAnswer })
      }
      markQuestionValidated(questionIndex ?? currentQuestionIndexRef.current)

      // Arrêter le timer existant pour le redémarrer avec la logique de reveal
      clearTimerInterval()

      // Jouer le son de révélation
      soundManager.playReveal()

      // Initialiser le timer du reveal
      const now = Date.now()
      phaseStartTimeRef.current = now
      revealStartTimeRef.current = now

      // Utiliser la durée du serveur si disponible, sinon celle de la question, sinon la valeur par défaut
      const currentQuestion = questionsRef.current[currentQuestionIndexRef.current]
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
      timerTickRef.current = updateRevealTimer

      // Démarrer le timer
      timerIntervalRef.current = window.setInterval(updateRevealTimer, 100)
    }
    socket.on('game:reveal', handleGameReveal)

    const handleAnswersValidated = ({
      validatedAnswers: validated,
      correctPlayers: correctPlayerIds,
      players,
      playerAnswers: playerAnswersData,
      questionIndex,
      correctAnswer,
    }: {
      validatedAnswers: Record<string, boolean>
      correctPlayers: string[]
      players: Player[]
      playerAnswers?: Record<string, string> // Réponses des joueurs
      questionIndex?: number
      correctAnswer?: string // Bonne réponse, envoyée seulement à la fin du guess
    }) => {
      if (typeof correctAnswer === 'string' && questionIndex !== undefined) {
        setRevealedAnswer({ questionIndex, answer: correctAnswer })
      }

      // Mettre à jour les scores des joueurs
      setGamePlayers(players)

      // Stocker les joueurs corrects pour le surlignage vert
      setCorrectPlayers(new Set(correctPlayerIds))

      // Stocker les réponses validées pour savoir si le joueur actuel a répondu correctement
      const { _validated, ...validatedByPlayer } = validated as Record<string, boolean>
      setValidatedAnswers(validatedByPlayer)
      // Réponses figées dès la validation (game:reveal suit immédiatement)
      markQuestionValidated(questionIndex ?? currentQuestionIndexRef.current)

      // Son d'erreur : un seul essai en ligne (voir QuestionCard), donc ce point de
      // validation serveur est le seul moment où la réponse du joueur devient définitive.
      const currentPlayerId = getPlayerId()
      if (currentPlayerId && validated[currentPlayerId] === false) {
        soundManager.playError()
      }

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

    const handleAnswerStored = ({ playerId: storedPlayerId }: { playerId: string }) => {
      // Ajouter le joueur à la liste des joueurs ayant répondu
      setAnsweredPlayers((prev) => new Set([...prev, storedPlayerId]))
      // Accusé de réception de notre réponse (le serveur traite nos envois dans l'ordre)
      if (storedPlayerId === playerId) {
        answerSyncRef.current.acked += 1
        if (answerSyncRef.current.acked >= answerSyncRef.current.sent) {
          setAnswerAckPending(false)
        }
      }
    }
    socket.on('game:answer-stored', handleAnswerStored)

    // Reconnexion : les messages émis pendant la coupure partent avant room:rejoin et le
    // serveur les ignore (joueur retrouvé par socketId). On renvoie donc la réponse en cours
    // tant que la question n'est pas validée.
    const handleRejoined = () => {
      setConnectionLost(false)
      if (phaseRef.current !== 'guess') return
      if (validatedQuestionIndexRef.current === currentQuestionIndexRef.current) return
      if (lastAnswerRef.current === null) return
      answerSyncRef.current = { sent: 1, acked: 0 }
      setAnswerAckPending(true)
      strategy.submitAnswer(lastAnswerRef.current)
    }
    socket.on('room:rejoined', handleRejoined)

    const handleDisconnect = () => setConnectionLost(true)
    const handleConnect = () => setConnectionLost(false)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect', handleConnect)

    socket.on('game:end', handleGameEnded)

    socket.on('error', handleError)

    // S'assurer que le socket est dans la room
    // Attendre d'abord que room:joined ou room:rejoined soit reçu avant de continuer
    let hasJoinedRoom = false

    // Jeton de session délivré si le fallback room:join crée le joueur
    const handleSessionToken = ({ sessionToken }: { sessionToken?: string } = {}) => {
      setSessionToken(roomCode, sessionToken)
    }
    socket.on('room:joined', handleSessionToken)

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
    socket.emit('room:rejoin', { roomCode, playerId, sessionToken: getSessionToken(roomCode) })

    // Timeout de sécurité : si on ne reçoit pas room:joined/rejoined après 2 secondes,
    // essayer room:join (peut-être que le joueur n'a jamais rejoint)
    const joinTimeout = setTimeout(() => {
      if (!hasJoinedRoom) emitJoinFallback()
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
      socket.off('room:joined', handleSessionToken)
      socket.off('game:start', handleGameStarted)
      socket.off('game:go', handleGameGo)
      socket.off('game:sync', handleGameSync)
      socket.off('game:next', handleNextQuestion)
      socket.off('game:reveal', handleGameReveal)
      socket.off('game:answers-validated', handleAnswersValidated)
      socket.off('game:skip-vote-updated', handleSkipVoteUpdated)
      socket.off('game:answer-stored', handleAnswerStored)
      socket.off('room:rejoined', handleRejoined)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect', handleConnect)
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

  // Onglet en arrière-plan : les intervalles sont ralentis (jusqu'à 1/min). Le chrono est
  // calculé depuis Date.now() (pas de dérive), mais l'affichage et la fin de phase solo
  // attendraient le tick suivant : on recalcule dès le retour au premier plan.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') timerTickRef.current?.()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Le host est maintenant déterminé depuis room:state

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId))
    }
  }, [])

  // Contenu du champ transmis par QuestionCard (envoi automatique) : il remplace la réponse
  // précédente du joueur (une seule réponse par question).
  const handleAnswer = (answer: string, _timeRemaining: number, _playerId?: string) => {
    if (showScore) return
    if (isTransitioningRef.current) return

    const trimmed = answer.trim()
    lastAnswerRef.current = trimmed
    if (isOnline(gameMode)) {
      answerSyncRef.current.sent += 1
      setAnswerAckPending(true)
    }
    strategy.submitAnswer(trimmed)
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
      setPlayerAnswers({}) // Réinitialiser les réponses pour la nouvelle question
      resetAnswerTracking()

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
    }
    // En ligne, le serveur gère le timer et décide quand passer à la question suivante
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
    // Solo : nouveaux départs aléatoires pour la nouvelle partie (en ligne : tirés par le serveur)
    if (isSolo(gameMode)) {
      const replayed = strategy.getInitialQuestions(gameQuestions)
      questionsRef.current = replayed
      setGameQuestions(replayed)
    }

    if (isOnline(gameMode) && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:restart', { roomCode })
        setGameStarted(false)
      }
    }
  }

  // « Changer les thèmes » (écran de fin, hôte) : la popup s'ouvre par-dessus l'écran de fin
  const handleChangeThemes = () => {
    setShowSettingsPopup(true)
  }

  const handleSettingsSaved = (
    newCategories: Category[],
    newQuestions: Question[],
    timeLimit: number,
    questionCount: number
  ) => {
    setShowSettingsPopup(false)
    // Même remise à zéro que « Rejouer » : sans elle, gameEndedRef resterait à true
    // si le nouveau tirage avait les mêmes questions (game:go ignoré)
    resetGameState()
    gameInstanceKeyRef.current += 1

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
        // newQuestions est le pool mélangé : en solo, on garde les questionCount premières
        onRestartWithNewCategories(newCategories, newQuestions.slice(0, questionCount))
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

  // Toujours une sortie possible depuis les écrans d'attente en ligne
  const leaveAndExit = () => {
    leaveRoom()
    onEndGame()
  }

  if (fatalError) {
    return <LoadingScreen message={fatalError} showSpinner={false} onBack={leaveAndExit} />
  }

  // En mode multijoueur, gérer différemment l'absence de questions
  if (isOnline(gameMode)) {
    if (!gameStarted) {
      return (
        <LoadingScreen
          message="En attente du démarrage..."
          subMessage="L'hôte va démarrer la partie."
          showSpinner={true}
          onBack={leaveAndExit}
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
          onBack={leaveAndExit}
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

  const displayScore = strategy.getDisplayScore(score, gamePlayers)
  const currentRevealedAnswer = isOnline(gameMode)
    ? revealedAnswer?.questionIndex === currentQuestionIndex
      ? revealedAnswer.answer
      : undefined
    : currentQuestion.answer
  // Résultat du joueur pour les annonces (n'existe qu'au reveal)
  const myId = strategy.getPlayerId()
  const myValidation = isOnline(gameMode)
    ? validatedAnswers[myId]
    : isRevealPhase
      ? correctPlayers.has('solo')
      : undefined
  const playerResult: PlayerResult =
    myValidation === true ? 'correct' : lastAnswerRef.current ? 'incorrect' : 'none'

  return (
    <MotionConfig reducedMotion="user">
      <div className={gameStyles.gameScreen} data-testid="game-screen">
        <GameAnnouncer
          questionKey={`${gameInstanceKeyRef.current}-${currentQuestionIndex}`}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={gameQuestions.length}
          isReveal={isRevealPhase}
          timeRemaining={timeRemaining}
          correctAnswer={currentRevealedAnswer}
          result={myValidation === undefined && isOnline(gameMode) ? 'none' : playerResult}
          score={displayScore}
          isGameEnded={showScore}
        />
        {connectionLost && isOnline(gameMode) && !showScore && (
          <div className={gameStyles.connectionBanner} role="status" data-testid="connection-lost">
            Connexion perdue — reconnexion en cours… Votre réponse sera renvoyée automatiquement.
          </div>
        )}
        <GameTopBar
          currentQuestionIndex={currentQuestionIndex}
          totalQuestions={gameQuestions.length}
          timeRemaining={timeRemaining}
          score={displayScore}
          inviteLink={inviteLink}
          muted={mediaMuted}
          onToggleMute={toggleMediaMuted}
          onQuit={() => setShowQuitConfirm(true)}
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
                score={displayScore}
                totalQuestions={gameQuestions.length}
                gameMode={gameMode}
                players={gamePlayers}
                isHost={isHost}
                shouldPlaySound={!successSoundPlayedRef.current}
                onRestart={handleRestart}
                onChangeThemes={handleChangeThemes}
                onQuit={() => setShowQuitConfirm(true)}
                onSoundPlayed={handleScoreSoundPlayed}
              />
            ) : (
              <RoundScreen
                question={currentQuestion}
                instanceKey={gameInstanceKeyRef.current}
                currentQuestionIndex={currentQuestionIndex}
                gameMode={gameMode}
                players={gamePlayers}
                timeRemaining={timeRemaining}
                isRevealPhase={isRevealPhase}
                skipVotes={skipVotes}
                correctPlayers={correctPlayers}
                answeredPlayers={answeredPlayers}
                playerAnswers={playerAnswers}
                validatedAnswers={validatedAnswers}
                answerSuggestions={answerSuggestions}
                revealedAnswer={isOnline(gameMode) ? currentRevealedAnswer : undefined}
                waitingForGo={waitingForGo}
                gameStep={gameStep}
                muted={mediaMuted}
                isGameEnded={gameEndedRef.current}
                isMediaReady={isSolo(gameMode) || (mediaReadyRef.current && !waitingForGo)}
                revealStartTime={
                  isOnline(gameMode) ? revealStartTimeRef.current || undefined : undefined
                }
                answerAckPending={answerAckPending}
                onAnswer={handleAnswer}
                onSkipVote={handleSkipVote}
                onMediaReady={isOnline(gameMode) ? handleMediaReady : undefined}
                onMediaStart={handleMediaStart}
                onRevealVideoStart={handleRevealVideoStart}
              />
            )}
          </div>
        </div>

        {/* Sortie confirmée : room:leave puis retour à l'accueil (barre du haut et écran de fin) */}
        <QuitGameDialog
          isOpen={showQuitConfirm}
          isOnline={isOnline(gameMode)}
          isHost={isHost}
          isGameEnded={showScore}
          onLeaveRoom={leaveRoom}
          onEndGame={onEndGame}
          onCancel={() => setShowQuitConfirm(false)}
        />

        {/* Popup « Changer les thèmes » : accessible seulement depuis l'écran de fin (hôte) */}
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
              <Dialog.Title style={{ display: 'none' }}>Changer les thèmes</Dialog.Title>
              <Dialog.Description style={{ display: 'none' }}>
                Choisir les thèmes, le timer et le nombre de questions de la prochaine partie
              </Dialog.Description>
              <GameSettingsPopup
                isOpen={true}
                currentCategories={settingsCategories}
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
    </MotionConfig>
  )
}
