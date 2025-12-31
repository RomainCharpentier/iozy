import { useEffect, useRef } from 'react'
import { getSocket } from '../../utils/socket'
import { getPlayerId } from '../../utils/playerId'
import type { Question } from '../../services/types'
import type { Player } from './types'

interface UseGameSocketParams {
  gameMode: 'solo' | 'online'
  roomCode?: string | null
  setGameQuestions: (questions: Question[]) => void
  setCurrentQuestionIndex: (index: number | ((prev: number) => number)) => void
  setGamePlayers: (players: Player[] | ((prev: Player[]) => Player[])) => void
  setIsHost: (isHost: boolean) => void
  setGameStarted: (started: boolean) => void
  setShowScore: (show: boolean) => void
  setWaitingForGo: (waiting: boolean) => void
  setGameStep: (step: string) => void
  setTimeRemaining: (time: number) => void
  setIsTimeUp: (isTimeUp: boolean) => void
  clearTimer: () => void
  questionsRef: React.MutableRefObject<Question[]>
  questionAnsweredByRef: React.MutableRefObject<string | null>
  isTransitioningRef: React.MutableRefObject<boolean>
  mediaReadyRef: React.MutableRefObject<boolean>
  goAtRef: React.MutableRefObject<number | null>
  gameDurationMsRef: React.MutableRefObject<number | null>
  mediaStartTimeRef: React.MutableRefObject<number | null>
  startTimer: (startedAt: number, durationMs: number, receivedAt?: number, serverTimeRemainingMs?: number, serverTime?: number) => void
  leaveRoom: () => void
}

export function useGameSocket({
  gameMode,
  roomCode,
  setGameQuestions,
  setCurrentQuestionIndex,
  setGamePlayers,
  setIsHost,
  setGameStarted,
  setShowScore,
  setWaitingForGo,
  setGameStep,
  setTimeRemaining,
  setIsTimeUp,
  clearTimer,
  questionsRef,
  questionAnsweredByRef,
  isTransitioningRef,
  mediaReadyRef,
  goAtRef,
  gameDurationMsRef,
  mediaStartTimeRef,
  startTimer,
  leaveRoom
}: UseGameSocketParams) {
  useEffect(() => {
    if (gameMode !== 'online' || !roomCode) return

    const socket = getSocket()
    if (!socket) return

    const playerId = getPlayerId()

    // Gérer beforeunload pour quitter proprement
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      leaveRoom()
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Attendre que le socket soit connecté avant de continuer
    if (!socket.connected) {
      const handleConnect = () => {
        socket.off('connect', handleConnect)
        socket.emit('room:rejoin', { roomCode, playerId })
        socket.emit('game:get-state', { roomCode })
      }
      socket.on('connect', handleConnect)
      return () => {
        socket.off('connect', handleConnect)
        window.removeEventListener('beforeunload', handleBeforeUnload)
        clearTimer()
      }
    }

    // S'assurer que le socket est dans la room
    if (socket.connected && roomCode) {
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
        
        if (state.game.durationMs) {
          gameDurationMsRef.current = state.game.durationMs
        }
        
        if (newGameStep === 'playing') {
          setWaitingForGo(false)
          setIsTimeUp(false)
          setTimeRemaining(0)
        } else {
          setWaitingForGo(true)
        }
      } else if (state.phase === 'waiting') {
        setGameStarted(false)
        clearTimer()
      } else if (state.phase === 'finished') {
        setShowScore(true)
        clearTimer()
      } else {
        clearTimer()
      }
    }

    const handleGameStarted = ({ 
      questions: serverQuestions, 
      questionIndex, 
      players: updatedPlayers,
      durationMs
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
      clearTimer()
      
      setIsTimeUp(false)
      setTimeRemaining(0)
      mediaStartTimeRef.current = null
    }

    const handleGameGo = ({ goAt, startedAt, durationMs, serverTime }: { goAt: number, startedAt: number, durationMs: number, serverTime?: number }) => {
      goAtRef.current = goAt
      gameDurationMsRef.current = durationMs
      setGameStep('starting')
      setWaitingForGo(true)
      
      const startGameAtGoTime = () => {
        setWaitingForGo(false)
        setGameStep('playing')
        
        setIsTimeUp(false)
        mediaStartTimeRef.current = null
        setTimeRemaining(0)
        
        // Fallback : si handleMediaStart n'est pas appelé dans les 3 secondes
        const fallbackTimer = setTimeout(() => {
          if (mediaStartTimeRef.current === null && 
              gameDurationMsRef.current && 
              mediaReadyRef.current && 
              gameDurationMsRef.current) {
            console.warn('[Game] Fallback: onMediaStart pas appelé après 3s, démarrage du timer')
            const fallbackNow = Date.now()
            mediaStartTimeRef.current = fallbackNow
            startTimer(fallbackNow, gameDurationMsRef.current, fallbackNow, undefined, undefined)
            setTimeRemaining(gameDurationMsRef.current / 1000)
            setIsTimeUp(false)
          }
        }, 3000)
        
        const cleanupTimerRef = { current: null as NodeJS.Timeout | null }
        cleanupTimerRef.current = setInterval(() => {
          if (mediaStartTimeRef.current !== null) {
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
      clearTimer()
      
      setIsTimeUp(false)
      setTimeRemaining(0)
      mediaStartTimeRef.current = null
    }

    const handleGameEnded = ({ players: finalPlayers }: { players: Player[] }) => {
      setGamePlayers(finalPlayers)
      setShowScore(true)
      clearTimer()
    }

    const handleError = ({ code, message }: { code: string, message: string }) => {
      if (code === 'PLAYER_NOT_FOUND' && roomCode) {
        socket.emit('room:join', { 
          roomCode, 
          playerId, 
          playerName: 'Joueur'
        })
        return
      }
      
      if (code !== 'GAME_ALREADY_STARTED') {
        console.error('[Game] Erreur serveur:', { code, message })
      }
    }

    const handleGameSync = ({ startedAt, durationMs, timeRemainingMs, serverTime, questionIndex }: { 
      startedAt: number
      durationMs: number
      timeRemainingMs: number
      serverTime: number
      questionIndex: number
    }) => {
      setWaitingForGo(false)
      setGameStep('playing')
      setCurrentQuestionIndex(questionIndex)
      gameDurationMsRef.current = durationMs
      setIsTimeUp(false)
      setTimeRemaining(0)
    }

    socket.on('room:state', handleRoomState)
    socket.on('game:start', handleGameStarted)
    socket.on('game:go', handleGameGo)
    socket.on('game:sync', handleGameSync)
    socket.on('game:next', handleNextQuestion)
    socket.on('game:correct-answer', handleCorrectAnswer)
    socket.on('game:end', handleGameEnded)
    socket.on('error', handleError)

    socket.on('reconnect', () => {
      socket.emit('room:rejoin', { roomCode, playerId })
    })

    let hasJoinedRoom = false
    
    const handleRoomJoinedOrRejoined = () => {
      if (!hasJoinedRoom) {
        hasJoinedRoom = true
        socket.emit('game:get-state', { roomCode })
      }
    }
    
    socket.once('room:joined', handleRoomJoinedOrRejoined)
    socket.once('room:rejoined', handleRoomJoinedOrRejoined)
    
    socket.emit('room:rejoin', { roomCode, playerId })
    
    const joinTimeout = setTimeout(() => {
      if (!hasJoinedRoom) {
        socket.emit('room:join', { 
          roomCode, 
          playerId, 
          playerName: 'Joueur'
        })
      }
    }, 2000)
    
    socket.once('room:joined', () => {
      clearTimeout(joinTimeout)
    })
    socket.once('room:rejoined', () => {
      clearTimeout(joinTimeout)
    })

    return () => {
      clearTimeout(joinTimeout)
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
      clearTimer()
    }
  }, [gameMode, roomCode, leaveRoom, clearTimer, startTimer])
}

