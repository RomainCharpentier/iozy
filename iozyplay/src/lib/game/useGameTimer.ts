import { useState, useRef, useEffect } from 'react'

interface UseGameTimerParams {
  gameMode: 'solo' | 'online'
  currentQuestionTimeLimit?: number
  onTimeUp?: () => void
}

interface UseGameTimerReturn {
  timeRemaining: number
  isTimeUp: boolean
  startTimer: (
    startedAt: number,
    durationMs: number,
    receivedAt?: number,
    serverTimeRemainingMs?: number,
    serverTime?: number
  ) => void
  clearTimer: () => void
  setTimeRemaining: (value: number) => void
  setIsTimeUp: (value: boolean) => void
}

export function useGameTimer({
  gameMode,
  currentQuestionTimeLimit,
  onTimeUp
}: UseGameTimerParams): UseGameTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false)
  const timerIntervalRef = useRef<number | null>(null)
  const gameStartedAtRef = useRef<number | null>(null)
  const gameDurationMsRef = useRef<number | null>(null)
  const serverTimeOffsetRef = useRef<number>(0)
  const revealTimerStartedRef = useRef<boolean>(false)

  const clearTimerInterval = () => {
    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }

  const startTimer = (
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
    const clientNow = Date.now()

    // Calculer l'offset entre le temps serveur et le temps client
    if (receivedAt && serverTime !== undefined) {
      serverTimeOffsetRef.current = serverTime - receivedAt
    } else if (receivedAt) {
      serverTimeOffsetRef.current = startedAt - receivedAt
    } else {
      serverTimeOffsetRef.current = 0
    }

    const updateTimer = () => {
      if (gameStartedAtRef.current === null || gameDurationMsRef.current === null) {
        return
      }

      const clientNow = Date.now()
      const elapsed = Math.max(0, clientNow - gameStartedAtRef.current)
      const remaining = Math.max(0, (gameDurationMsRef.current - elapsed) / 1000)

      setTimeRemaining(remaining)

      const hasFullyElapsed = elapsed >= gameDurationMsRef.current
      const newIsTimeUp = hasFullyElapsed && gameStartedAtRef.current !== null && gameDurationMsRef.current !== null

      setIsTimeUp(newIsTimeUp)

      // Si le timer de guess atteint 0, démarrer le timer du reveal
      if (newIsTimeUp && !revealTimerStartedRef.current) {
        revealTimerStartedRef.current = true

        if (gameDurationMsRef.current !== null) {
          const revealDurationMs = gameDurationMsRef.current

          const revealTimer = setTimeout(() => {
            if (gameMode === 'solo' && onTimeUp) {
              onTimeUp()
            }
          }, revealDurationMs)
        }
      }

      // Si le temps est écoulé, appeler onTimeUp une seule fois (mode solo seulement)
      if (newIsTimeUp && !isTimeUp && gameMode === 'solo' && !revealTimerStartedRef.current && onTimeUp) {
        onTimeUp()
      }
    }

    // Mettre à jour immédiatement
    updateTimer()

    // Programmer les mises à jour régulières
    timerIntervalRef.current = window.setInterval(updateTimer, 100)
  }

  const clearTimer = () => {
    clearTimerInterval()
    gameStartedAtRef.current = null
    gameDurationMsRef.current = null
    revealTimerStartedRef.current = false
    setIsTimeUp(false)
    setTimeRemaining(0)
  }

  useEffect(() => {
    return () => {
      clearTimerInterval()
    }
  }, [])

  return {
    timeRemaining,
    isTimeUp,
    startTimer,
    clearTimer,
    setTimeRemaining,
    setIsTimeUp
  }
}

