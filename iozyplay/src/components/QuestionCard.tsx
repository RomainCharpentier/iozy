import { useState, useEffect, useRef } from 'react'
import { Question, GameMode, Player } from '../types'
import MediaPlayer from './MediaPlayer'
import { soundManager } from '../utils/sounds'

interface QuestionCardProps {
  question: Question
  onAnswer: (isCorrect: boolean, timeRemaining: number, playerId?: string) => void
  onTimeUp: () => void
  gameMode?: GameMode
  players?: Player[]
  questionAnsweredBy?: string | null
}

export default function QuestionCard({ 
  question, 
  onAnswer, 
  onTimeUp, 
  gameMode = 'solo',
  players = [],
  questionAnsweredBy = null
}: QuestionCardProps) {
  // Vérification de sécurité au début
  if (!question) {
    return (
      <div className="question-card">
        <p>Erreur : Question introuvable.</p>
      </div>
    )
  }

  // État pour les réponses
  const [userAnswer, setUserAnswer] = useState<string>('')
  const [attempts, setAttempts] = useState<number>(0)
  const [isCorrect, setIsCorrect] = useState<boolean>(false)
  
  const [timeRemaining, setTimeRemaining] = useState<number>(question.timeLimit || 5)
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    // Reset pour chaque nouvelle question
    if (!question) return
    
    if (gameMode === 'solo') {
      setUserAnswer('')
      setAttempts(0)
      setIsCorrect(false)
      inputRefs.current['solo']?.focus()
    }
    // En mode en ligne, la gestion se fait via Socket.io
    
    setTimeRemaining(question.timeLimit || 5)
    setIsTimeUp(false)
  }, [question.id, question.timeLimit, gameMode, players])

  useEffect(() => {
    // Timer pour chaque question
    const hasAnswered = gameMode === 'solo' 
      ? isCorrect 
      : questionAnsweredBy !== null
    
    if (hasAnswered || isTimeUp) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsTimeUp(true)
          soundManager.playCountdownEnd() // Son de fin de compte à rebours
          onTimeUp() // Passer à la question suivante automatiquement
          return 0
        }
        // Son d'avertissement quand il reste peu de temps
        if (prev === 3) {
          soundManager.playClick()
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isCorrect, isTimeUp, questionAnsweredBy, gameMode])

  const handleSubmit = (playerId?: string) => {
    if (gameMode === 'solo') {
      if (!userAnswer.trim() || isCorrect || isTimeUp) return

      const answer = userAnswer.toLowerCase().trim()
      const correctAnswer = question.answer.toLowerCase().trim()
      const isAnswerCorrect = answer === correctAnswer

      setAttempts(prev => prev + 1)

      if (isAnswerCorrect) {
        setIsCorrect(true)
        soundManager.playSuccess() // Son de succès
        onAnswer(true, timeRemaining)
      } else {
        // Réponse incorrecte, on peut réessayer
        soundManager.playError() // Son d'erreur
        setUserAnswer('')
        inputRefs.current['solo']?.focus()
      }
    } else {
      // Mode multijoueur en ligne - la gestion se fait via Socket.io dans le backend
      // On envoie juste la réponse au serveur
      if (!userAnswer.trim() || questionAnsweredBy !== null || isTimeUp) return

      const answer = userAnswer.toLowerCase().trim()
      const correctAnswer = question.answer.toLowerCase().trim()
      const isAnswerCorrect = answer === correctAnswer

      setAttempts(prev => prev + 1)

      if (isAnswerCorrect) {
        setIsCorrect(true)
        soundManager.playSuccess() // Son de succès
        // En mode en ligne, onAnswer enverra la réponse au serveur via Socket.io
        onAnswer(true, timeRemaining)
      } else {
        // Réponse incorrecte, on peut réessayer
        soundManager.playError() // Son d'erreur
        setUserAnswer('')
        inputRefs.current['online']?.focus()
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>, playerId?: string) => {
    if (e.key === 'Enter') {
      handleSubmit(playerId)
    }
  }

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      series: '📺',
      animes: '🎌',
      chansons: '🎵',
      films: '🎬',
      jeux: '🎮',
    }
    return emojis[category] || '❓'
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      series: 'Série TV',
      animes: 'Anime',
      chansons: 'Chanson',
      films: 'Film',
      jeux: 'Jeu vidéo',
    }
    return labels[category] || 'Média'
  }

  return (
    <div className="question-card">
      <div className="question-header">
        <div className="question-category">
          {getCategoryEmoji(question.category)} {getCategoryLabel(question.category)}
        </div>
        <h2 className="question-prompt">
          🎵 Devine la musique ! 🎵
        </h2>
      </div>

      <div className="media-container">
        {question.mediaUrl && (
          <MediaPlayer 
            type={question.type} 
            mediaUrl={question.mediaUrl}
            autoPlay={false}
            showVideo={isTimeUp}
            restartVideo={isTimeUp}
            timeLimit={question.timeLimit || 5}
            onVideoRestarted={() => {
              // La vidéo a été relancée pour le reveal
            }}
          />
        )}
      </div>

      <div className="question-timer">
        <div className={`timer-display ${timeRemaining <= 10 ? 'warning' : ''} ${isTimeUp ? 'time-up' : ''}`}>
          ⏱️ {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
        </div>
        {gameMode === 'solo' && attempts > 0 && (
          <div className="attempts-counter">
            Tentatives : {attempts}
          </div>
        )}
      </div>

      <div className="text-answer">
        {gameMode === 'solo' ? (
          <>
            <div className="answer-input-container">
              <input
                ref={(el) => { inputRefs.current['solo'] = el }}
                type="text"
                placeholder="Tapez votre réponse et appuyez sur Entrée..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e)}
                disabled={isCorrect || isTimeUp}
                className={`answer-input ${isCorrect ? 'correct' : ''} ${isTimeUp ? 'disabled' : ''}`}
              />
              <button
                onClick={() => {
                  soundManager.playClick()
                  handleSubmit()
                }}
                disabled={!userAnswer.trim() || isCorrect || isTimeUp}
                className="submit-button"
              >
                Valider
              </button>
            </div>

            {isCorrect && (
              <div className="answer-feedback correct">
                ✅ Correct ! Vous avez trouvé en {attempts} tentative{attempts > 1 ? 's' : ''} !
              </div>
            )}

            {isTimeUp && !isCorrect && (
              <div className="answer-feedback time-up">
                ⏱️ Temps écoulé ! La réponse était : <strong>{question.answer}</strong>
              </div>
            )}

            {attempts > 0 && !isCorrect && !isTimeUp && (
              <div className="answer-feedback incorrect">
                ❌ Incorrect. Réessayez !
              </div>
            )}
          </>
        ) : (
          <>
            <div className="answer-input-container">
              <input
                ref={(el) => { inputRefs.current['online'] = el }}
                type="text"
                placeholder="Tapez votre réponse et appuyez sur Entrée..."
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e)}
                disabled={questionAnsweredBy !== null || isTimeUp}
                className={`answer-input ${questionAnsweredBy !== null ? 'disabled' : ''} ${isTimeUp ? 'disabled' : ''}`}
              />
              <button
                onClick={() => {
                  soundManager.playClick()
                  handleSubmit()
                }}
                disabled={!userAnswer.trim() || questionAnsweredBy !== null || isTimeUp}
                className="submit-button"
              >
                Valider
              </button>
            </div>

            {questionAnsweredBy !== null && (
              <div className="answer-feedback correct">
                🎉 {players.find(p => p.id === questionAnsweredBy)?.name || 'Quelqu\'un'} a trouvé la bonne réponse !
              </div>
            )}

            {isTimeUp && questionAnsweredBy === null && (
              <div className="answer-feedback time-up">
                ⏱️ Temps écoulé ! La réponse était : <strong>{question.answer}</strong>
              </div>
            )}
          </>
        )}
      </div>

      {question.hint && (
        <div className="hint">
          💡 Indice : {question.hint}
        </div>
      )}
    </div>
  )
}
