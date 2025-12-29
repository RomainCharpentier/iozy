import { useState, useRef, useEffect, useCallback } from 'react'
import QuestionCard from './question/QuestionCard'
import Score from './ui/Score'
import GameSettingsPopup from './settings/GameSettingsPopup'
import GameTopBar from './ui/GameTopBar'
import PlayersPanel from './ui/PlayersPanel'
import GameLoadingState from './ui/GameLoadingState'
import type { Category, Question } from '../../services/types'
import type { GameMode, Player } from '../../lib/game/types'
import { getSocket } from '../../utils/socket'
import { getPlayerId } from '../../utils/playerId'
import { GameService, TIMING } from '../../services/gameService'

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
  const revealStartTimeRef = useRef<number | null>(null)
  const revealStartTimeClientRef = useRef<number | null>(null)
  const gameEndedRef = useRef<boolean>(false)
  const lastSkipVoteTimeRef = useRef<number>(0) // Pour le debounce
  const [waitingForGo, setWaitingForGo] = useState<boolean>(gameMode === 'online') // En mode multijoueur, on attend toujours le signal "go" au début
  const mediaReadyRef = useRef<boolean>(false) // Indique si le média est préchargé
  const [gameStep, setGameStep] = useState<string>('loading') // Étape actuelle: loading, ready, starting, playing
  const handleTimeUpRef = useRef<(() => void) | null>(null) // Référence à handleTimeUp pour l'utiliser dans startTimerCalculation
  const [skipVotes, setSkipVotes] = useState<Set<string>>(new Set()) // Joueurs qui ont voté skip
  const [correctPlayers, setCorrectPlayers] = useState<Set<string>>(new Set()) // Joueurs qui ont répondu correctement (pour surlignage vert)
  const soloAnswersRef = useRef<string[]>([]) // Réponses stockées en mode solo (non validées)

  useEffect(() => {
    if (gameQuestions.length === 0) return
    questionsRef.current = gameQuestions
    if (currentQuestionIndex >= gameQuestions.length) {
      setCurrentQuestionIndex(0)
    }
    // Ne pas réinitialiser showScore si la partie est terminée
    if (!gameEndedRef.current) {
      setShowScore(false)
    }
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
      const initialRemaining = serverTimeRemainingMs / 1000
      setTimeRemaining(initialRemaining)
      setIsTimeUp(initialRemaining === 0)

      const updateTimer = () => {
        if (gameDurationMsRef.current === null) return
        
        const clientNow = Date.now()
        
        // Si revealStartTimeClientRef est défini, on est en phase reveal
        // Utiliser revealStartTimeClientRef au lieu de isTimeUp pour éviter les problèmes de closure
        if (revealStartTimeClientRef.current !== null) {
          // revealStartTimeClientRef.current est le timestamp client du début du chrono reveal
          // gameDurationMsRef.current contient maintenant la durée de reveal (mise à jour dans handleRevealVideoStart ou handleGameReveal)
          const elapsed = Math.max(0, clientNow - revealStartTimeClientRef.current)
          const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)
          
          setTimeRemaining(revealRemaining)
          setIsTimeUp(true)
          
          // Si le reveal est terminé, le serveur devrait envoyer game:next
          // Mais on peut aussi vérifier ici pour être sûr
          if (revealRemaining <= 0.1) {
            // Le reveal est terminé, mais on attend le serveur pour passer à la question suivante
            setTimeRemaining(0)
            setIsTimeUp(true)
          }
          return
        }
        
        // Phase guess : utiliser le temps restant du serveur
        // Vérifier que receivedAt est défini avant de l'utiliser
        if (receivedAt !== undefined && serverTimeRemainingMs !== undefined) {
          const elapsedSinceReceive = clientNow - receivedAt
          const remaining = Math.max(0, (serverTimeRemainingMs - elapsedSinceReceive) / 1000)
          setTimeRemaining(remaining)
          setIsTimeUp(remaining === 0)
        } else {
          // Si receivedAt n'est pas défini, on ne peut pas calculer le temps restant
          // Cela ne devrait pas arriver en mode multijoueur, mais on gère le cas
          console.warn('[Game] updateTimer: receivedAt or serverTimeRemainingMs is undefined', { receivedAt, serverTimeRemainingMs })
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
      if (gameStartedAtRef.current === null || gameDurationMsRef.current === null) {
        return
      }

      const clientNow = Date.now()
      
      // Si on est en phase reveal, calculer le temps restant
      if (isTimeUp) {
        // Si revealStartTimeRef est défini (timestamp serveur), l'utiliser pour synchroniser précisément
        if (revealStartTimeClientRef.current !== null) {
          // revealStartTimeClientRef.current est le timestamp client du début du chrono (chrono à la durée complète)
          // Le chrono compte depuis ce moment jusqu'à 0
          const elapsed = Math.max(0, clientNow - revealStartTimeClientRef.current)
          const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)
          
          setTimeRemaining(revealRemaining)
          setIsTimeUp(true)
          
          // Si le reveal est terminé, appeler handleTimeUp pour le mode solo
          if (revealRemaining <= 0.5 && gameMode === 'solo' && handleTimeUpRef.current) {
            handleTimeUpRef.current()
          }
          return
        }
        
        // Si revealStartTimeClientRef n'est pas encore défini, initialiser le chrono immédiatement
        // (fallback pour le mode solo ou si onRevealVideoStart n'a pas été appelé)
        if (revealStartTimeClientRef.current === null) {
          revealStartTimeClientRef.current = clientNow
          // S'assurer que gameDurationMsRef contient la durée de reveal
          const currentQuestion = gameQuestions[currentQuestionIndex]
          if (currentQuestion) {
            gameDurationMsRef.current = (currentQuestion.timeLimit || TIMING.DEFAULT_TIME_LIMIT) * 1000
          }
        }
        
        // Calculer le temps restant en utilisant revealStartTimeClientRef
        const elapsed = Math.max(0, clientNow - revealStartTimeClientRef.current)
        const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)
        setTimeRemaining(revealRemaining)
        setIsTimeUp(true)
        
        // Si le reveal est terminé, appeler handleTimeUp pour le mode solo
        if (revealRemaining <= 0.5 && gameMode === 'solo' && handleTimeUpRef.current) {
          handleTimeUpRef.current()
        }
        return
      }

      // Phase guess : calculer le temps écoulé depuis le début de la question
      // gameStartedAtRef.current est maintenant un timestamp client (pas serveur)
      // donc on peut le comparer directement avec clientNow
      const elapsed = Math.max(0, clientNow - gameStartedAtRef.current)
      // Calculer le temps restant
      const remaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

      setTimeRemaining(remaining)

      // isTimeUp devient true seulement quand le temps de guess est complètement écoulé
      // On accepte aussi remaining <= 0.5 pour gérer les cas où le serveur passe à la question suivante
      // avant que le timer client ne soit complètement terminé (le serveur peut avoir un léger délai)
      const hasFullyElapsed = elapsed >= gameDurationMsRef.current || remaining <= 0.5
      const newIsTimeUp = hasFullyElapsed && gameStartedAtRef.current !== null && gameDurationMsRef.current !== null

      // En mode solo, définir revealStartTimeRef et revealStartTimeClientRef dès que isTimeUp devient true
      // et mettre à jour gameDurationMsRef avec la durée de reveal
      if (newIsTimeUp && !isTimeUp && gameMode === 'solo') {
        if (revealStartTimeRef.current === null) {
          revealStartTimeRef.current = Date.now()
        }
        if (revealStartTimeClientRef.current === null) {
          revealStartTimeClientRef.current = Date.now()
          // Mettre à jour gameDurationMsRef avec la durée de reveal
          const currentQuestion = gameQuestions[currentQuestionIndex]
          if (currentQuestion) {
            gameDurationMsRef.current = (currentQuestion.timeLimit || TIMING.DEFAULT_TIME_LIMIT) * 1000
          }
        }
      }

      setIsTimeUp(newIsTimeUp)

      // Si le temps est écoulé, appeler handleTimeUp une seule fois (mode solo seulement, avant le reveal)
      if (newIsTimeUp && !isTimeUp && gameMode === 'solo' && !revealTimerStartedRef.current && handleTimeUpRef.current) {
        handleTimeUpRef.current()
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
    if (gameMode === 'online') {
      setWaitingForGo(true)
    } else {
      setWaitingForGo(false)
    }
  }, [gameMode])

  const handleRevealVideoStart = () => {
    const now = Date.now()
    revealStartTimeClientRef.current = now
    revealStartTimeRef.current = now
    
    const currentQuestion = gameQuestions[currentQuestionIndex]
    const revealDurationMs = (currentQuestion?.timeLimit || TIMING.DEFAULT_TIME_LIMIT) * 1000
    
    // Mettre à jour la durée pour le timer reveal
    gameDurationMsRef.current = revealDurationMs
    
    // Initialiser le temps restant avec la durée complète de reveal
    setTimeRemaining(revealDurationMs / 1000)
    
    // S'assurer que isTimeUp est true pour que le timer utilise la logique reveal
    setIsTimeUp(true)
  }

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
      // Ne pas réinitialiser showScore si la partie est terminée
      if (!gameEndedRef.current) {
        setShowScore(false)
      } else {
      }

      if (updatedPlayers?.length) {
        setGamePlayers(updatedPlayers)
      }

      setWaitingForGo(true)
      mediaReadyRef.current = false
      setGameStep('loading')
      clearTimerInterval()

      // Réinitialiser le timer au démarrage de la partie
      setIsTimeUp(false)
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
      setIsTimeUp(false)
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
      setTimeRemaining(0)

      // Fallback : si handleMediaStart n'est pas appelé dans les 3 secondes, démarrer le timer quand même
      const fallbackTimer = setTimeout(() => {
        if (mediaStartTimeRef.current === null &&
          gameDurationMsRef.current &&
          mediaReadyRef.current &&
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

      setWaitingForGo(true)
      mediaReadyRef.current = false
      revealStartTimeRef.current = null
      revealStartTimeClientRef.current = null
      setGameStep('loading')
      clearTimerInterval()

      // Réinitialiser le timer pour la nouvelle question
      // Le timer sera démarré dans handleMediaStart quand le média commence vraiment à jouer
      setIsTimeUp(false)
      setTimeRemaining(0) // Reste à 0 jusqu'à ce que le média démarre
      revealTimerStartedRef.current = false
      mediaStartTimeRef.current = null
      
      // Réinitialiser les refs du timer pour éviter les valeurs résiduelles
      gameStartedAtRef.current = null
      gameDurationMsRef.current = null
      
      // Réinitialiser les votes skip, les joueurs corrects et les réponses stockées pour la nouvelle question
      setSkipVotes(new Set())
      setCorrectPlayers(new Set())
      soloAnswersRef.current = []
      
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

    const handleGameReveal = ({ durationMs }: { questionIndex?: number, durationMs?: number }) => {
      
      // Arrêter le timer existant pour le redémarrer avec la logique de reveal
      clearTimerInterval()
      
      // Initialiser le timer du reveal
      const now = Date.now()
      revealStartTimeClientRef.current = now
      revealStartTimeRef.current = now
      
      // Utiliser la durée du serveur si disponible, sinon celle de la question, sinon la valeur par défaut
      const currentQuestion = gameQuestions[currentQuestionIndex]
      const revealDurationMs = durationMs || (currentQuestion?.timeLimit || TIMING.DEFAULT_TIME_LIMIT) * 1000
      gameDurationMsRef.current = revealDurationMs
      
      // Mettre à jour le temps restant pour le reveal
      setTimeRemaining(revealDurationMs / 1000)
      setIsTimeUp(true)
      
      // Réinitialiser les votes skip pour la phase reveal
      setSkipVotes(new Set())
      
      // Redémarrer le timer avec la logique de reveal
      const updateRevealTimer = () => {
        if (gameDurationMsRef.current === null || revealStartTimeClientRef.current === null) {
          return
        }
        
        const clientNow = Date.now()
        const elapsed = Math.max(0, clientNow - revealStartTimeClientRef.current)
        const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)
        
        setTimeRemaining(revealRemaining)
        setIsTimeUp(true)
        
        // Si le reveal est terminé, le serveur devrait envoyer game:next
        if (revealRemaining <= 0.1) {
          setTimeRemaining(0)
          setIsTimeUp(true)
        }
      }
      
      // Mettre à jour immédiatement
      updateRevealTimer()
      
      // Démarrer le timer
      timerIntervalRef.current = window.setInterval(updateRevealTimer, 100)
    }
    socket.on('game:reveal', handleGameReveal)
    
    const handleAnswersValidated = ({ validatedAnswers, correctPlayers: correctPlayerIds, players }: {
      validatedAnswers: Record<string, boolean>
      correctPlayers: string[]
      players: Player[]
    }) => {
      // Mettre à jour les scores des joueurs
      setGamePlayers(players)
      
      // Stocker les joueurs corrects pour le surlignage vert
      setCorrectPlayers(new Set(correctPlayerIds))
    }
    socket.on('game:answers-validated', handleAnswersValidated)
    
    const handleSkipVoteUpdated = ({ playerId, skipVotes: votes, allPlayersVoted }: {
      playerId: string
      skipVotes: string[]
      allPlayersVoted: boolean
    }) => {
      setSkipVotes(new Set(votes))
    }
    socket.on('game:skip-vote-updated', handleSkipVoteUpdated)
    
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
      socket.off('game:reveal', handleGameReveal)
      socket.off('game:answers-validated', handleAnswersValidated)
      socket.off('game:skip-vote-updated', handleSkipVoteUpdated)
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

  const handleAnswer = (answer: string, _timeRemaining: number, _playerId?: string) => {
    if (showScore) return
    if (isTransitioningRef.current) return

    // En mode multijoueur, stocker la réponse sans la valider
    if (gameMode === 'online' && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:answer', {
          roomCode,
          answer: answer
        })
      }
      // La validation se fera à la fin du guess (timer ou skip)
      return
    }

    // En mode solo, stocker la réponse sans la valider
    // La validation se fera à la fin du guess (timer ou skip)
    soloAnswersRef.current.push(answer)
  }

  // Valider les réponses en mode solo
  const validateSoloAnswers = () => {
    const currentQuestion = gameQuestions[currentQuestionIndex]
    if (!currentQuestion) return

    const correctAnswer = currentQuestion.answer.toLowerCase().trim()
    let hasCorrect = false

    // Vérifier toutes les réponses stockées
    for (const answer of soloAnswersRef.current) {
      const isCorrect = answer.toLowerCase().trim() === correctAnswer
      if (isCorrect) {
        hasCorrect = true
        break
      }
    }

    // Si une réponse est correcte, donner le point et surligner
    if (hasCorrect) {
      setScore(prev => prev + 1)
      setCorrectPlayers(new Set(['solo']))
    }

    // Réinitialiser les réponses stockées
    soloAnswersRef.current = []
  }

  const handleSkipVote = useCallback(() => {
    const now = Date.now()
    
    // Debounce : empêcher les clics trop rapides (minimum 500ms entre deux clics)
    if (now - lastSkipVoteTimeRef.current < 500) {
      return
    }
    
    // Vérifier que le média est prêt et que la partie n'est pas terminée
    if (gameEndedRef.current) {
      return
    }
    
    if (!mediaReadyRef.current || waitingForGo) {
      return
    }
    
    // Vérifier si le joueur a déjà voté skip
    const playerId = gameMode === 'solo' ? 'solo' : (getPlayerId() || '')
    if (skipVotes.has(playerId)) {
      return
    }
    
    // Mettre à jour le timestamp du dernier clic
    lastSkipVoteTimeRef.current = now
    
    if (gameMode === 'online' && roomCode) {
      const socket = getSocket()
      if (socket) {
        socket.emit('game:skip-vote', { roomCode })
      }
    } else {
      // En mode solo, skip directement (pas besoin de vote)
      if (isTimeUp) {
        // Phase reveal : passer à la question suivante
        if (handleTimeUpRef.current) {
          handleTimeUpRef.current()
        }
        // Réinitialiser les votes skip
        setSkipVotes(new Set())
      } else {
        // Phase guess : valider les réponses et passer au reveal
        
        // Arrêter le timer du guess
        clearTimerInterval()
        
        // Valider les réponses
        validateSoloAnswers()
        
        // Initialiser le timer du reveal
        const revealNow = Date.now()
        revealStartTimeClientRef.current = revealNow
        revealStartTimeRef.current = revealNow
        
        const currentQuestion = gameQuestions[currentQuestionIndex]
        const revealDurationMs = (currentQuestion?.timeLimit || TIMING.DEFAULT_TIME_LIMIT) * 1000
        gameDurationMsRef.current = revealDurationMs
        
        // Mettre à jour le temps restant pour le reveal
        setTimeRemaining(revealDurationMs / 1000)
        setIsTimeUp(true)
        
        // Redémarrer le timer pour la phase reveal
        const updateRevealTimer = () => {
          if (gameDurationMsRef.current === null || revealStartTimeClientRef.current === null) {
            return
          }
          
          const clientNow = Date.now()
          const elapsed = Math.max(0, clientNow - revealStartTimeClientRef.current)
          const revealRemaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)
          
          setTimeRemaining(revealRemaining)
          
          // Si le reveal est terminé, passer à la question suivante
          if (revealRemaining <= 0.5 && handleTimeUpRef.current) {
            clearTimerInterval()
            handleTimeUpRef.current()
          }
        }
        
        updateRevealTimer()
        timerIntervalRef.current = window.setInterval(updateRevealTimer, 100)
        
        // Marquer qu'on a voté skip (pour l'affichage)
        setSkipVotes(new Set(['solo']))
      }
    }
  }, [gameMode, isTimeUp, roomCode, waitingForGo, skipVotes, validateSoloAnswers, gameQuestions, currentQuestionIndex])

  const handleTimeUp = () => {
    if (showScore) return
    if (isTransitioningRef.current) return

    if (gameMode === 'solo') {
      // En mode solo, valider les réponses à la fin du guess
      if (!isTimeUp) {
        // Phase guess : valider les réponses avant de passer au reveal
        validateSoloAnswers()
        setIsTimeUp(true)
        return // Ne pas passer à la question suivante, juste passer au reveal
      }

      // Phase reveal : passer à la question suivante
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
    gameEndedRef.current = false
    setShowScore(false)
    setCurrentQuestionIndex(0)
    setScore(0)
    questionAnsweredByRef.current = null
    isTransitioningRef.current = false
    
    // Réinitialiser le debounce
    lastSkipVoteTimeRef.current = 0

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
          onSkipVote={handleSkipVote}
          gameMode={gameMode}
          players={gamePlayers}
          questionAnsweredBy={questionAnsweredByRef.current}
          shouldPause={showScore || showSettingsPopup}
          onTimerUpdate={handleTimerUpdate}
          onMediaReady={gameMode === 'online' ? handleMediaReady : undefined}
          onMediaStart={handleMediaStart} // Toujours utiliser handleMediaStart pour démarrer le timer au bon moment
          onRevealVideoStart={handleRevealVideoStart}
          waitingForGo={waitingForGo}
          gameStep={gameStep}
          externalTimeRemaining={gameMode === 'online' ? timeRemaining : undefined}
          externalIsTimeUp={gameMode === 'online' ? isTimeUp : undefined}
          skipVotes={skipVotes}
          correctPlayers={correctPlayers}
          startTime={gameMode === 'online' ? (revealStartTimeRef.current || undefined) : undefined}
          isGameEnded={gameEndedRef.current}
          isMediaReady={mediaReadyRef.current && !waitingForGo}
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
          correctPlayers={correctPlayers}
          isTimeUp={isTimeUp}
        />
      )}

      {(showScore || showSettingsPopup) && (
        <div 
          className="modal-overlay"
          data-testid="modal-overlay" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            pointerEvents: 'auto'
          }}
          onClick={() => {
            if (showSettingsPopup) {
              setShowSettingsPopup(false)
              setShowScore(true)
            } else {
              onEndGame()
            }
          }}
        >
          <div 
            className="modal-content" 
            style={{
              position: 'relative',
              zIndex: 100000,
              backgroundColor: 'var(--card-bg, #1e293b)',
              borderRadius: '1.5rem',
              padding: '2.5rem',
              maxWidth: '500px',
              width: '90%',
              border: '2px solid var(--border-color, #334155)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
              <div className="score-popup-content" style={{ 
                position: 'relative',
                zIndex: 10002,
                backgroundColor: 'var(--card-bg, #1e293b)',
                padding: '2rem',
                borderRadius: '1rem'
              }}>
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




