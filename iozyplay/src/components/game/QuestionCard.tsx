import { useState, useEffect, useRef } from 'react'
import { Question, GameMode, Player } from '../../types'
import MediaPlayer from '../media/MediaPlayer'
import { soundManager } from '../../utils/sounds'
import { TIMING } from '../../constants/timing'

interface QuestionCardProps {
  question: Question
  onAnswer: (isCorrect: boolean, timeRemaining: number, playerId?: string) => void
  onTimeUp: () => void
  gameMode?: GameMode
  players?: Player[]
  questionAnsweredBy?: string | null
  shouldPause?: boolean
  onTimerUpdate?: (timeRemaining: number, isTimeUp: boolean) => void
  onMediaReady?: () => void
  onMediaStart?: () => void // Appelé quand le média commence vraiment à jouer
  waitingForGo?: boolean
  gameStep?: string // loading, ready, starting, playing
  externalTimeRemaining?: number // Temps restant depuis le parent (pour mode multijoueur)
  externalIsTimeUp?: boolean // État isTimeUp depuis le parent (pour mode multijoueur)
}

export default function QuestionCard({ 
  question, 
  onAnswer, 
  onTimeUp, 
  gameMode = 'solo',
  players = [],
  questionAnsweredBy = null,
  shouldPause = false,
  onTimerUpdate,
  onMediaReady,
  onMediaStart,
  waitingForGo = false,
  gameStep = 'loading',
  externalTimeRemaining,
  externalIsTimeUp
}: QuestionCardProps) {
  if (!question) {
    return (
      <div className="question-card">
        <p>Erreur : Question introuvable.</p>
      </div>
    )
  }

  const [userAnswer, setUserAnswer] = useState<string>('')
  const [attempts, setAttempts] = useState<number>(0)
  const [isCorrect, setIsCorrect] = useState<boolean>(false)
  // En mode multijoueur, utiliser directement les valeurs externes (pas d'état local)
  // En mode solo, utiliser l'état local
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(question.timeLimit || TIMING.DEFAULT_TIME_LIMIT)
  const [localIsTimeUp, setLocalIsTimeUp] = useState<boolean>(false)
  const [mediaReady, setMediaReady] = useState<boolean>(false)
  const [shouldStartMedia, setShouldStartMedia] = useState<boolean>(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  
  // Utiliser les valeurs externes en mode multijoueur, sinon les valeurs locales
  const timeRemaining = gameMode === 'online' && externalTimeRemaining !== undefined 
    ? externalTimeRemaining 
    : localTimeRemaining
  const isTimeUp = gameMode === 'online' && externalIsTimeUp !== undefined 
    ? externalIsTimeUp 
    : localIsTimeUp
  
  // Fonctions pour mettre à jour le temps (utilisées seulement en mode solo)
  const setTimeRemaining = (value: number) => {
    if (gameMode === 'solo') {
      setLocalTimeRemaining(value)
    }
  }
  const setIsTimeUp = (value: boolean) => {
    if (gameMode === 'solo') {
      setLocalIsTimeUp(value)
    }
  }

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mediaReadySentRef = useRef<boolean>(false)

  useEffect(() => {
    if (!question) return
    
    // Réinitialiser l'état du média pour la nouvelle question
    setMediaReady(false)
    mediaReadySentRef.current = false
    
    // Nettoyer le timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    if (gameMode === 'online') {
      // En mode multijoueur, permettre le chargement du média même si on attend le "go"
      // Le média doit charger pour que onMediaReady soit appelé et que game:ready soit envoyé
      setShouldStartMedia(true)
      
      // Fallback : si le média ne charge pas après 3 secondes, envoyer quand même game:ready
      // pour éviter que le joueur reste bloqué
      timeoutRef.current = setTimeout(() => {
        if (!mediaReadySentRef.current && onMediaReady) {
          mediaReadySentRef.current = true
          setMediaReady(true)
          onMediaReady()
        }
        timeoutRef.current = null
      }, 3000)
    }
    
    if (gameMode === 'solo') {
      setUserAnswer('')
      setAttempts(0)
      setIsCorrect(false)
      inputRefs.current['solo']?.focus()
    }
    
    setTimeRemaining(question.timeLimit || TIMING.DEFAULT_TIME_LIMIT)
    setIsTimeUp(false)
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [question.id, question.timeLimit, gameMode, players])
  
  useEffect(() => {
    if (gameMode === 'online') {
      // En mode multijoueur, permettre le chargement du média même si on attend le "go"
      // Le média doit charger pour que onMediaReady soit appelé et que game:ready soit envoyé
      if (!shouldStartMedia) {
        setShouldStartMedia(true)
      }
    }
  }, [waitingForGo, gameMode, shouldStartMedia])


  useEffect(() => {
    const hasAnswered = gameMode === 'solo' 
      ? isCorrect 
      : questionAnsweredBy !== null
    
    // En mode multijoueur, utiliser le timer externe (géré par Game.tsx)
    // mais seulement si on n'attend plus le "go"
    if (gameMode === 'online') {
      // Le timer est géré par le parent (Game.tsx) via externalTimeRemaining et externalIsTimeUp
      // On ne fait rien ici, le parent gère le timer
      return
    }
    
    // Mode solo : gérer le timer localement
    if (hasAnswered || isTimeUp || !mediaReady) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsTimeUp(true)
          soundManager.playCountdownEnd()
          onTimeUp()
          return 0
        }
        if (prev === TIMING.COUNTDOWN_WARNING_THRESHOLD) {
          soundManager.playClick()
        }
        return prev - 1
      })
    }, TIMING.TIMER_INTERVAL)

    return () => clearInterval(timer)
  }, [isCorrect, isTimeUp, questionAnsweredBy, gameMode, mediaReady])

  useEffect(() => {
    if (onTimerUpdate) {
      onTimerUpdate(timeRemaining, isTimeUp)
    }
  }, [timeRemaining, isTimeUp, onTimerUpdate])

  const handleSubmit = (playerId?: string) => {
    if (gameMode === 'solo') {
      if (!userAnswer.trim() || isCorrect || isTimeUp) return

      const answer = userAnswer.toLowerCase().trim().replace(/\s+/g, ' ')
      const correctAnswer = question.answer.toLowerCase().trim().replace(/\s+/g, ' ')
      const isAnswerCorrect = answer === correctAnswer

      setAttempts(prev => prev + 1)

      if (isAnswerCorrect) {
        setIsCorrect(true)
        soundManager.playSuccess()
        onAnswer(true, timeRemaining)
      } else {
        soundManager.playError()
        setUserAnswer('')
        inputRefs.current['solo']?.focus()
      }
    } else {
      if (!userAnswer.trim() || questionAnsweredBy !== null || isTimeUp) return

      const answer = userAnswer.toLowerCase().trim().replace(/\s+/g, ' ')
      const correctAnswer = question.answer.toLowerCase().trim().replace(/\s+/g, ' ')
      const isAnswerCorrect = answer === correctAnswer

      setAttempts(prev => prev + 1)

      if (isAnswerCorrect) {
        setIsCorrect(true)
        soundManager.playSuccess()
        onAnswer(true, timeRemaining)
      } else {
        soundManager.playError()
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
      </div>

      <div className="media-container" data-testid="media-container">
        {question.mediaUrl && (
          <>
            {waitingForGo && gameMode === 'online' && (
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: 100,
                borderRadius: '0.5rem',
                pointerEvents: 'none' // Permettre l'interaction avec le média en dessous
              }}>
                <div style={{ textAlign: 'center', color: 'white', background: 'rgba(0, 0, 0, 0.8)', padding: '20px', borderRadius: '0.5rem' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
                  <p>⏳ Synchronisation...</p>
                  <p style={{ fontSize: '0.9em', opacity: 0.8 }}>
                    {gameStep === 'loading' && !mediaReady && 'Chargement du média...'}
                    {gameStep === 'loading' && mediaReady && 'En attente des autres joueurs...'}
                    {gameStep === 'ready' && 'Tous les joueurs sont prêts !'}
                    {gameStep === 'starting' && 'Démarrage dans quelques instants...'}
                  </p>
                </div>
              </div>
            )}
            <MediaPlayer 
              type={question.type} 
              mediaUrl={question.mediaUrl}
              autoPlay={gameMode === 'solo' || (gameMode === 'online' && shouldStartMedia && !waitingForGo && mediaReady)}
              showVideo={isTimeUp}
              restartVideo={isTimeUp || (gameMode === 'online' && shouldStartMedia && !waitingForGo && mediaReady)}
              timeLimit={question.timeLimit || TIMING.DEFAULT_TIME_LIMIT}
              onVideoRestarted={() => {}}
              shouldPause={shouldPause || (gameMode === 'online' && waitingForGo)}
              onMediaReady={() => {
                // Éviter d'envoyer plusieurs fois game:ready pour la même question
                if (mediaReadySentRef.current) {
                  return
                }
                
                // Annuler le timeout car le média est chargé
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current)
                  timeoutRef.current = null
                }
                
                // Toujours marquer le média comme prêt pour le chargement
                setMediaReady(true)
                mediaReadySentRef.current = true
                
                // En mode multijoueur, toujours signaler au serveur que le média est prêt
                // même si on attend le signal "go" - c'est nécessaire pour que le serveur
                // envoie le signal "go" quand tous les joueurs sont prêts
                if (gameMode === 'online' && onMediaReady) {
                  // Appeler onMediaReady de manière asynchrone pour s'assurer que le média est vraiment prêt
                  setTimeout(() => {
                    onMediaReady()
                  }, 100)
                }
              }}
              onMediaStart={() => {
                if (onMediaStart) {
                  onMediaStart()
                }
              }}
            />
          </>
        )}
      </div>

      <div className="question-bottom-section">
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
                aria-label="Zone de saisie de la réponse"
                autoComplete="off"
              />
              {gameMode === 'solo' && attempts > 0 && (
                <div className="attempts-counter">
                  {attempts} tent.
                </div>
              )}
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
                aria-label="Zone de saisie de la réponse"
                autoComplete="off"
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
    </div>
  )
}
