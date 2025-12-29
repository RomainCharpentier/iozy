import { useState, useEffect, useRef } from 'react'
import type { Question } from '../../../services/types'
import type { GameMode, Player } from '../../../lib/game/types'
import MediaPlayer from '../../../components/media/MediaPlayer'
import AnswerInput from './AnswerInput'
import AnswerFeedback from './AnswerFeedback'
import MediaSyncOverlay from './MediaSyncOverlay'
import { soundManager } from '../../../utils/sounds'
import { TIMING } from '../../../services/gameService'
import { getPlayerId } from '../../../utils/playerId'

interface QuestionCardProps {
  question: Question
  onAnswer: (answer: string, timeRemaining: number, playerId?: string) => void // Modifié pour accepter la réponse (string) au lieu de isCorrect
  onTimeUp: () => void
  onSkipVote?: () => void // Fonction pour voter skip
  gameMode?: GameMode
  players?: Player[]
  questionAnsweredBy?: string | null
  shouldPause?: boolean
  onTimerUpdate?: (timeRemaining: number, isTimeUp: boolean) => void
  onMediaReady?: () => void
  onMediaStart?: () => void // Appelé quand le média commence vraiment à jouer
  onRevealVideoStart?: () => void // Callback appelé quand la vidéo display démarre en phase reveal
  waitingForGo?: boolean
  gameStep?: string // loading, ready, starting, playing
  externalTimeRemaining?: number // Temps restant depuis le parent (pour mode multijoueur)
  externalIsTimeUp?: boolean // État isTimeUp depuis le parent (pour mode multijoueur)
  skipVotes?: Set<string> // Joueurs qui ont voté skip
  correctPlayers?: Set<string> // Joueurs qui ont répondu correctement (pour surlignage vert)
  startTime?: number // Timestamp serveur pour synchroniser le démarrage (pour mode multijoueur)
  isGameEnded?: boolean // Indique si la partie est terminée
  isMediaReady?: boolean // Indique si le média est prêt et lancé
}

export default function QuestionCard({ 
  question, 
  onAnswer, 
  onTimeUp,
  onSkipVote,
  gameMode = 'solo',
  players = [],
  questionAnsweredBy = null,
  shouldPause = false,
  onTimerUpdate,
  onMediaReady,
  onMediaStart,
  onRevealVideoStart,
  waitingForGo = false,
  gameStep = 'loading',
  externalTimeRemaining,
  externalIsTimeUp,
  skipVotes = new Set(),
  correctPlayers = new Set(),
  startTime,
  isGameEnded = false,
  isMediaReady = false
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
  const setTimeRemaining = (value: number | ((prev: number) => number)) => {
    if (gameMode === 'solo') {
      if (typeof value === 'function') {
        setLocalTimeRemaining(value)
      } else {
        setLocalTimeRemaining(value)
      }
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
    
    // Réinitialiser l'état de la réponse (pour permettre de soumettre à nouveau)
    setIsCorrect(false)
    
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
      setTimeRemaining((prev: number) => {
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
    if (!userAnswer.trim() || isTimeUp) return

    // Stocker la réponse sans la valider (validation à la fin du guess)
    setAttempts(prev => prev + 1)
    
    // Envoyer la réponse au parent (qui la stockera côté serveur en multijoueur)
    onAnswer(userAnswer, timeRemaining, playerId)
    
    // Vider le champ de saisie
    setUserAnswer('')
    
    // Remettre le focus sur l'input
    if (gameMode === 'solo') {
      inputRefs.current['solo']?.focus()
    } else {
      inputRefs.current['online']?.focus()
    }
  }


  const getCategoryEmoji = (category: string | string[]) => {
    const categoryStr = Array.isArray(category) ? category[0] : category
    const emojis: Record<string, string> = {
      series: '📺',
      animes: '🎌',
      chansons: '🎵',
      films: '🎬',
      jeux: '🎮',
    }
    return emojis[categoryStr] || '❓'
  }

  const getCategoryLabel = (category: string | string[]) => {
    const categoryStr = Array.isArray(category) ? category[0] : category
    const labels: Record<string, string> = {
      series: 'Série TV',
      animes: 'Anime',
      chansons: 'Chanson',
      films: 'Film',
      jeux: 'Jeu vidéo',
    }
    return labels[categoryStr] || 'Média'
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
            {waitingForGo && gameMode === 'online' && gameStep !== 'playing' && (
              <MediaSyncOverlay gameStep={gameStep} mediaReady={mediaReady} />
            )}
            <MediaPlayer 
              type={question.type} 
              mediaUrl={question.mediaUrl}
              autoPlay={gameMode === 'solo' || (gameMode === 'online' && shouldStartMedia && !waitingForGo && mediaReady)}
              showVideo={isTimeUp}
              restartVideo={false}
              timeLimit={question.timeLimit || TIMING.DEFAULT_TIME_LIMIT}
              onVideoRestarted={() => {}}
              shouldPause={shouldPause || (gameMode === 'online' && waitingForGo)}
              onRevealVideoStart={onRevealVideoStart}
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
              startTime={startTime}
            />
          </>
        )}
      </div>

      <div className="question-bottom-section">
      <div className="text-answer">
        {gameMode === 'solo' ? (
          <>
            <AnswerInput
              value={userAnswer}
              onChange={setUserAnswer}
              onSubmit={() => handleSubmit()}
              disabled={isCorrect || isTimeUp}
              attempts={attempts}
              showAttempts={true}
              inputRef={(el) => { inputRefs.current['solo'] = el }}
            />
            <AnswerFeedback
              isCorrect={isCorrect}
              isTimeUp={isTimeUp}
              attempts={attempts}
              correctAnswer={question.answer}
            />
          </>
        ) : (
          <>
            <AnswerInput
              value={userAnswer}
              onChange={setUserAnswer}
              onSubmit={() => handleSubmit()}
              disabled={questionAnsweredBy !== null || isTimeUp}
              inputRef={(el) => { inputRefs.current['online'] = el }}
            />
            <AnswerFeedback
              isCorrect={questionAnsweredBy !== null}
              isTimeUp={isTimeUp && questionAnsweredBy === null}
              attempts={attempts}
              correctAnswer={question.answer}
              answeredBy={questionAnsweredBy}
              playerName={players.find(p => p.id === questionAnsweredBy)?.name}
            />
          </>
        )}
      </div>

      {question.hint && (
        <div className="hint">
          💡 Indice : {question.hint}
        </div>
      )}
      
      {/* Bouton Skip */}
      {onSkipVote && (
        <div className="skip-button-container">
          {(() => {
            const playerId = gameMode === 'solo' ? 'solo' : (getPlayerId() || '')
            const hasVoted = skipVotes.has(playerId)
            const canSkip = !isGameEnded && isMediaReady && !waitingForGo && !hasVoted
            
            return (
              <>
                <button
                  className={`skip-button ${hasVoted ? 'voted' : ''} ${!canSkip ? 'disabled' : ''}`}
                  onClick={onSkipVote}
                  disabled={!canSkip}
                  title={
                    isGameEnded 
                      ? 'La partie est terminée'
                      : !isMediaReady || waitingForGo
                      ? 'Attendez que le média démarre'
                      : hasVoted
                      ? 'Vous avez déjà voté skip'
                      : 'Passer cette question'
                  }
                >
                  ⏭️ Skip
                </button>
                {gameMode === 'online' && skipVotes.size > 0 && (
                  <div className="skip-votes-info">
                    {skipVotes.size} / {players.length} joueurs ont voté skip
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
      </div>
    </div>
  )
}
