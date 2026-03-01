import { useState, useRef, useEffect } from 'react'
import { isSolo } from '@/lib/game/gameMode'

interface UseGameTimerParams {
  gameMode: 'solo' | 'online'
  currentQuestionTimeLimit?: number
  onPhaseEnd?: () => void
}

interface UseGameTimerReturn {
  timeRemaining: number
  isRevealPhase: boolean
  startTimer: (
    startedAt: number,
    durationMs: number,
    receivedAt?: number,
    serverTimeRemainingMs?: number,
    serverTime?: number
  ) => void
  clearTimer: () => void
  setTimeRemaining: (value: number) => void
  setIsRevealPhase: (value: boolean) => void
}

export function useGameTimer({
  gameMode,
  currentQuestionTimeLimit,
  onPhaseEnd,
}: UseGameTimerParams): UseGameTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isRevealPhase, setIsRevealPhase] = useState<boolean>(false)
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
    setIsRevealPhase(false)
    revealTimerStartedRef.current = false

    gameStartedAtRef.current = startedAt
    gameDurationMsRef.current = durationMs

    // Utiliser le temps restant calculé par le serveur si disponible
    if (serverTimeRemainingMs !== undefined && serverTime !== undefined && receivedAt) {
      serverTimeOffsetRef.current = serverTime - receivedAt
      const initialRemaining = serverTimeRemainingMs / 1000
      setTimeRemaining(initialRemaining)
      setIsRevealPhase(initialRemaining === 0)

      const updateTimer = () => {
        if (gameDurationMsRef.current === null) return
        const elapsedSinceReceive = Date.now() - receivedAt
        const remaining = Math.max(0, (serverTimeRemainingMs - elapsedSinceReceive) / 1000)
        setTimeRemaining(remaining)
        setIsRevealPhase(remaining === 0)
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
      const newIsRevealPhase =
        hasFullyElapsed && gameStartedAtRef.current !== null && gameDurationMsRef.current !== null

      setIsRevealPhase(newIsRevealPhase)

      // Si le timer de guess atteint 0, démarrer le timer du reveal
      if (newIsRevealPhase && !revealTimerStartedRef.current) {
        revealTimerStartedRef.current = true

        if (gameDurationMsRef.current !== null) {
          const revealDurationMs = gameDurationMsRef.current

          const revealTimer = setTimeout(() => {
            if (isSolo(gameMode) && onPhaseEnd) {
              onPhaseEnd()
            }
          }, revealDurationMs)
        }
      }

      // Si le temps est écoulé, appeler onPhaseEnd une seule fois (mode solo seulement)
      if (
        newIsRevealPhase &&
        !isRevealPhase &&
        isSolo(gameMode) &&
        !revealTimerStartedRef.current &&
        onPhaseEnd
      ) {
        onPhaseEnd()
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
    setIsRevealPhase(false)
    setTimeRemaining(0)
  }

  useEffect(() => {
    return () => {
      clearTimerInterval()
    }
  }, [])

  return {
    timeRemaining,
    isRevealPhase,
    startTimer,
    clearTimer,
    setTimeRemaining,
    setIsRevealPhase,
  }
}
