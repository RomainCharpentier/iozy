import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useEffect, useRef, useState } from 'react'

export type PlayerResult = 'correct' | 'incorrect' | 'none'

/** Seuil du chrono critique annoncé (une fois par question) */
export const CRITICAL_TIME_SECONDS = 5

interface GameAnnouncerProps {
  /** Identifie la question (partie + index) : chaque annonce part au plus une fois par question */
  questionKey: string
  questionNumber: number
  totalQuestions: number
  isReveal: boolean
  timeRemaining: number
  /** Bonne réponse, connue seulement au reveal */
  correctAnswer?: string
  result: PlayerResult
  score: number
  isGameEnded: boolean
}

const RESULT_TEXT: Record<PlayerResult, string> = {
  correct: 'Votre réponse est correcte.',
  incorrect: 'Votre réponse est incorrecte.',
  none: 'Vous n’avez pas répondu.',
}

/**
 * Région aria-live (polie) pour les changements importants de l'écran de jeu : nouvelle
 * question, chrono critique, reveal (bonne réponse, résultat du joueur, score) et fin de
 * partie. Rien n'est annoncé pendant la frappe ; le résultat n'existe qu'au reveal.
 */
export default function GameAnnouncer({
  questionKey,
  questionNumber,
  totalQuestions,
  isReveal,
  timeRemaining,
  correctAnswer,
  result,
  score,
  isGameEnded,
}: GameAnnouncerProps) {
  const [message, setMessage] = useState('')
  const announcedRef = useRef<Set<string>>(new Set())

  const announce = (key: string, text: string) => {
    if (announcedRef.current.has(key)) return
    announcedRef.current.add(key)
    setMessage(text)
  }

  useEffect(() => {
    if (isGameEnded) return
    announce(`question-${questionKey}`, `Question ${questionNumber} sur ${totalQuestions}.`)
  }, [questionKey, isGameEnded])

  useEffect(() => {
    if (isGameEnded || isReveal) return
    if (timeRemaining > 0 && timeRemaining <= CRITICAL_TIME_SECONDS) {
      announce(`critical-${questionKey}`, `Plus que ${CRITICAL_TIME_SECONDS} secondes.`)
    }
  }, [questionKey, isReveal, timeRemaining, isGameEnded])

  useEffect(() => {
    if (isGameEnded || !isReveal || !correctAnswer) return
    announce(
      `reveal-${questionKey}`,
      `Temps écoulé. La bonne réponse était : ${correctAnswer}. ${RESULT_TEXT[result]} Score : ${score}.`
    )
  }, [questionKey, isReveal, correctAnswer, result, score, isGameEnded])

  useEffect(() => {
    if (!isGameEnded) return
    announce(`end-${questionKey}`, `Partie terminée. Votre score : ${score} sur ${totalQuestions}.`)
  }, [isGameEnded, questionKey, score, totalQuestions])

  return (
    <div
      className={gameStyles.visuallyHidden}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="game-announcer"
    >
      {message}
    </div>
  )
}
