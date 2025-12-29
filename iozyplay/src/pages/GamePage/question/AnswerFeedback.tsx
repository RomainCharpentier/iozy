interface AnswerFeedbackProps {
  isCorrect: boolean
  isTimeUp: boolean
  attempts: number
  correctAnswer?: string
  answeredBy?: string | null
  playerName?: string
  gameMode?: 'solo' | 'online' // Pour différencier le comportement
}

export default function AnswerFeedback({
  isCorrect,
  isTimeUp,
  attempts,
  correctAnswer,
  answeredBy,
  playerName,
  gameMode = 'solo'
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

  // En mode solo, afficher le feedback immédiatement si incorrect
  // En mode multijoueur, on ne sait pas encore (validation à la fin)
  if (!isTimeUp && attempts > 0 && !isCorrect && gameMode === 'solo') {
    // Afficher un feedback pour indiquer que ce n'est pas correct (mode solo uniquement)
    return (
      <div className="answer-feedback incorrect-subtle">
        ❌ Réessayez
      </div>
    )
  }

  // Afficher "Incorrect" en phase reveal si ce n'est pas correct
  if (isTimeUp && attempts > 0 && !isCorrect) {
    return (
      <div className="answer-feedback incorrect">
        ❌ Incorrect. La réponse était : <strong>{correctAnswer}</strong>
      </div>
    )
  }

  return null
}

