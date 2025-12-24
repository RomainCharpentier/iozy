interface AnswerFeedbackProps {
  isCorrect: boolean
  isTimeUp: boolean
  attempts: number
  correctAnswer?: string
  answeredBy?: string | null
  playerName?: string
}

export default function AnswerFeedback({
  isCorrect,
  isTimeUp,
  attempts,
  correctAnswer,
  answeredBy,
  playerName
}: AnswerFeedbackProps) {
  if (isCorrect) {
    return (
      <div className="answer-feedback correct">
        {answeredBy ? (
          <>🎉 {playerName || 'Quelqu\'un'} a trouvé la bonne réponse !</>
        ) : (
          <>✅ Correct ! Vous avez trouvé en {attempts} tentative{attempts > 1 ? 's' : ''} !</>
        )}
      </div>
    )
  }

  if (isTimeUp) {
    return (
      <div className="answer-feedback time-up">
        ⏱️ Temps écoulé ! La réponse était : <strong>{correctAnswer}</strong>
      </div>
    )
  }

  if (attempts > 0 && !isCorrect) {
    return (
      <div className="answer-feedback incorrect">
        ❌ Incorrect. Réessayez !
      </div>
    )
  }

  return null
}




