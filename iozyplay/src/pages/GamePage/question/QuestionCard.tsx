import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo, isOnline } from '@/lib/game/gameMode'
import MediaPlayer from '@/components/media/MediaPlayer'
import AnswerInput from '@/pages/GamePage/question/AnswerInput'
import MediaSyncOverlay from '@/pages/GamePage/question/MediaSyncOverlay'
import { TIMING } from '@/services/gameService'
import { getPlayerId } from '@/utils/playerId'
import { compareAnswers } from '@/utils/answerNormalization'
import CategoryIcon from '@/components/common/CategoryIcon'
import type { CategoryInfo } from '@/types'
import { DEFAULT_CATEGORIES } from '@/types'
import { loadCategories } from '@/services/categoryService'

interface QuestionCardProps {
  question: Question
  onAnswer: (answer: string, timeRemaining: number, playerId?: string) => void // Modifié pour accepter la réponse (string) au lieu de isCorrect
  onPhaseEnd: () => void
  onSkipVote?: () => void // Fonction pour voter skip
  gameMode?: GameMode
  players?: Player[]
  questionAnsweredBy?: string | null
  shouldPause?: boolean
  onMediaReady?: () => void
  onMediaStart?: () => void // Appelé quand le média commence vraiment à jouer
  onRevealVideoStart?: () => void // Callback appelé quand la vidéo display démarre en phase reveal
  waitingForGo?: boolean
  gameStep?: string // loading, ready, starting, playing
  externalTimeRemaining?: number // Temps restant depuis le parent (pour mode multijoueur)
  externalIsRevealPhase?: boolean
  skipVotes?: Set<string> // Joueurs qui ont voté skip
  correctPlayers?: Set<string> // Joueurs qui ont répondu correctement (pour surlignage vert)
  startTime?: number // Timestamp serveur pour synchroniser le démarrage (pour mode multijoueur)
  isGameEnded?: boolean // Indique si la partie est terminée
  isMediaReady?: boolean // Indique si le média est prêt et lancé
  allQuestions?: Question[] // Toutes les questions de la partie (pour les suggestions)
  validatedAnswers?: Record<string, boolean> // Réponses validées par le serveur (mode multijoueur)
}

export default function QuestionCard({
  question,
  onAnswer,
  onPhaseEnd,
  onSkipVote,
  gameMode = 'solo',
  players = [],
  questionAnsweredBy = null,
  shouldPause = false,
  onMediaReady,
  onMediaStart,
  onRevealVideoStart,
  waitingForGo = false,
  gameStep = 'loading',
  externalTimeRemaining,
  externalIsRevealPhase,
  skipVotes = new Set(),
  correctPlayers = new Set(),
  startTime,
  isGameEnded = false,
  isMediaReady = false,
  allQuestions = [],
  validatedAnswers = {},
}: QuestionCardProps) {
  const [categories, setCategories] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES)

  useEffect(() => {
    loadCategories().then((cats) => {
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
    })
  }, [])

  if (!question) {
    return (
      <div className={gameStyles.questionCard}>
        <p>Erreur : Question introuvable.</p>
      </div>
    )
  }

  const [userAnswer, setUserAnswer] = useState<string>('')
  const [attempts, setAttempts] = useState<number>(0)
  const [isCorrect, setIsCorrect] = useState<boolean>(false)
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false) // Indique si une réponse a été soumise (pour le feedback visuel)
  // En mode multijoueur, utiliser directement les valeurs externes (pas d'état local)
  // En mode solo, utiliser l'état local
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(
    question.timeLimit || TIMING.DEFAULT_TIME_LIMIT
  )
  const [localIsRevealPhase, setLocalIsRevealPhase] = useState<boolean>(false)
  const [mediaReady, setMediaReady] = useState<boolean>(false)
  const [shouldStartMedia, setShouldStartMedia] = useState<boolean>(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const focusTimeoutRef = useRef<number | null>(null)

  const timeRemaining =
    externalTimeRemaining !== undefined ? externalTimeRemaining : localTimeRemaining
  const isRevealPhase =
    externalIsRevealPhase !== undefined ? externalIsRevealPhase : localIsRevealPhase

  // En mode multijoueur, déterminer si le joueur actuel a répondu correctement
  const currentPlayerId = isOnline(gameMode) ? getPlayerId() : null
  const isCurrentPlayerCorrect =
    isOnline(gameMode) && currentPlayerId
      ? validatedAnswers[currentPlayerId] === true
      : isCorrect

  // Fonctions pour mettre à jour le temps (utilisées seulement en mode solo)
  const setTimeRemaining = (value: number | ((prev: number) => number)) => {
    if (isSolo(gameMode)) {
      setLocalTimeRemaining(value)
    }
  }
  const setIsRevealPhase = (value: boolean) => {
    if (isSolo(gameMode)) {
      setLocalIsRevealPhase(value)
    }
  }

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mediaReadySentRef = useRef<boolean>(false)
  const previousQuestionIdRef = useRef<string | undefined>(question.id)

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

    if (isOnline(gameMode)) {
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
    } else {
      timeoutRef.current = setTimeout(() => {
        if (!mediaReadySentRef.current) {
          mediaReadySentRef.current = true
          setMediaReady(true)
        }
        timeoutRef.current = null
      }, 3000)
    }

    if (previousQuestionIdRef.current !== question.id) {
      previousQuestionIdRef.current = question.id

      setUserAnswer('')
      setAttempts(0)
      setIsCorrect(false)
      setHasSubmitted(false)
    }

    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current)
    }
    focusTimeoutRef.current = window.setTimeout(() => {
      const inputKey = isSolo(gameMode) ? 'solo' : 'online'
      inputRefs.current[inputKey]?.focus()
      focusTimeoutRef.current = null
    }, 100)

    setTimeRemaining(question.timeLimit || TIMING.DEFAULT_TIME_LIMIT)
    setIsRevealPhase(false)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current)
        focusTimeoutRef.current = null
      }
    }
  }, [question.id, question.timeLimit, gameMode])

  useEffect(() => {
    if (isOnline(gameMode)) {
      // En mode multijoueur, permettre le chargement du média même si on attend le "go"
      // Le média doit charger pour que onMediaReady soit appelé et que game:ready soit envoyé
      if (!shouldStartMedia) {
        setShouldStartMedia(true)
      }
    }
  }, [waitingForGo, gameMode, shouldStartMedia])

  // Timer géré par Game - QuestionCard affiche les valeurs reçues en props

  const handleMediaReady = useCallback(() => {
    if (mediaReadySentRef.current) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setMediaReady(true)
    mediaReadySentRef.current = true
    if (isOnline(gameMode) && onMediaReady) {
      setTimeout(() => onMediaReady(), 100)
    }
  }, [gameMode, onMediaReady])

  const handleSubmit = (playerId?: string, answerValue?: string) => {
    // Utiliser la valeur fournie en paramètre si disponible, sinon utiliser userAnswer
    const answerToUse = answerValue !== undefined ? answerValue : userAnswer

    if (!answerToUse.trim() || isRevealPhase) return

    const answer = answerToUse.trim()
    let isAnswerCorrect = false

    // En mode solo, valider immédiatement pour donner un feedback
    if (isSolo(gameMode)) {
      // Utiliser la fonction de normalisation pour gérer les accents et caractères spéciaux
      isAnswerCorrect = compareAnswers(answer, question.answer)

      if (isAnswerCorrect) {
        setIsCorrect(true)
        setUserAnswer(answer)
        setIsRevealPhase(true)
        // IMPORTANT: onAnswer AVANT onPhaseEnd pour que validateAnswers trouve la réponse dans soloAnswersRef
        onAnswer(answer, timeRemaining, playerId)
        onPhaseEnd()
      } else {
        setIsCorrect(false)
        // Vider le champ pour permettre de réessayer
        setUserAnswer('')
      }
    } else {
      // En mode multijoueur, mettre à jour userAnswer avec la valeur soumise
      if (answerValue !== undefined) {
        setUserAnswer(answerValue)
      }
    }

    // Validation finale faite en fin de phase guess (timer ou skip)
    setAttempts((prev) => prev + 1)
    setHasSubmitted(true) // Marquer qu'une réponse a été soumise (pour le feedback visuel)

    // Envoyer la réponse au parent (qui la stockera côté serveur en multijoueur)
    // En solo correct: déjà fait plus haut. En solo incorrect ou multi: faire ici
    if (!(isSolo(gameMode) && isAnswerCorrect)) {
      onAnswer(answer, timeRemaining, playerId)
    }

    // En mode solo, si la réponse est correcte, garder hasSubmitted pour montrer le feedback
    if (isSolo(gameMode) && isAnswerCorrect) {
      // Ne pas réinitialiser hasSubmitted si c'est correct - on veut garder le feedback
      return
    }

    // En mode multijoueur ou si incorrect en solo, permettre de modifier après un délai
    // pour montrer le feedback visuel (icône check) mais permettre de modifier
    if (isSolo(gameMode) && !isAnswerCorrect) {
      setHasSubmitted(false)
      inputRefs.current['solo']?.focus()
    } else if (!isSolo(gameMode)) {
      // En multijoueur, garder hasSubmitted pour montrer le feedback
      // Ne pas réinitialiser automatiquement - l'utilisateur peut modifier en tapant
      // hasSubmitted sera réinitialisé par handleAnswerChange quand l'utilisateur tape
    }
  }

  // Réinitialiser hasSubmitted quand l'utilisateur commence à taper
  const handleAnswerChange = (value: string) => {
    setUserAnswer(value)
    if (hasSubmitted && value.trim().length > 0) {
      setHasSubmitted(false) // Permettre de modifier la réponse
    }
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

  const getCategoryId = (category: string | string[]) => {
    return Array.isArray(category) ? category[0] : category
  }

  const getCategoryInfo = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)
  }

  const categoryId = getCategoryId(question.category)
  const categoryInfo = getCategoryInfo(categoryId)

  return (
    <div className={`${gameStyles.questionCard} ${gameStyles.questionCardGameInterfaceGame}`}>
      <div className={gameStyles.gameInterfaceGameHeader}>
        <div className={gameStyles.gameInterfaceCategory}>
          <span className={gameStyles.gameInterfaceCategoryIcon}>
            <CategoryIcon categoryId={categoryId} iconId={categoryInfo?.emoji} size={20} />
          </span>
          <span className={gameStyles.gameInterfaceCategoryText}>
            {getCategoryLabel(question.category)}
          </span>
        </div>
      </div>

      <div className={`${gameStyles.mediaContainer} ${gameStyles.gameInterfaceMedia}`} data-testid="media-container">
        {question.mediaUrl && (
          <>
            {waitingForGo && isOnline(gameMode) && gameStep !== 'playing' && (
              <MediaSyncOverlay gameStep={gameStep} mediaReady={mediaReady} />
            )}
            <MediaPlayer
              type={question.type}
              mediaUrl={question.mediaUrl}
              autoPlay={
                isSolo(gameMode) ||
                (isOnline(gameMode) && shouldStartMedia && !waitingForGo && mediaReady)
              }
              showVideo={isRevealPhase}
              restartVideo={false}
              timeLimit={question.timeLimit || TIMING.DEFAULT_TIME_LIMIT}
              onVideoRestarted={() => {}}
              shouldPause={shouldPause || (isOnline(gameMode) && waitingForGo)}
              onRevealVideoStart={onRevealVideoStart}
              onMediaReady={handleMediaReady}
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

      <div className={gameStyles.gameInterfaceAnswer}>
        {isSolo(gameMode) ? (
          <>
            <AnswerInput
              value={userAnswer}
              onChange={handleAnswerChange}
              onSubmit={(value) => handleSubmit(undefined, value)}
              disabled={isCorrect || isRevealPhase}
              inputRef={(el) => {
                inputRefs.current['solo'] = el
              }}
              hasSubmitted={hasSubmitted}
              allQuestions={allQuestions}
              currentQuestionId={question.id}
              isReveal={isRevealPhase}
              isCorrect={isRevealPhase ? isCorrect : undefined}
              correctAnswer={isRevealPhase ? question.answer : undefined}
              onSkipVote={onSkipVote}
              skipVotes={skipVotes}
              gameMode={gameMode}
              players={players}
              isGameEnded={isGameEnded}
              isMediaReady={isMediaReady}
              waitingForGo={waitingForGo}
            />
          </>
        ) : (
          <>
            <AnswerInput
              value={userAnswer}
              onChange={handleAnswerChange}
              onSubmit={(value) => handleSubmit(undefined, value)}
              disabled={questionAnsweredBy !== null || isRevealPhase}
              inputRef={(el) => {
                inputRefs.current['online'] = el
              }}
              hasSubmitted={hasSubmitted}
              allQuestions={allQuestions}
              currentQuestionId={question.id}
              isReveal={isRevealPhase}
              isCorrect={isRevealPhase ? isCurrentPlayerCorrect : undefined}
              correctAnswer={isRevealPhase ? question.answer : undefined}
              onSkipVote={onSkipVote}
              skipVotes={skipVotes}
              gameMode={gameMode}
              players={players}
              isGameEnded={isGameEnded}
              isMediaReady={isMediaReady}
              waitingForGo={waitingForGo}
            />
          </>
        )}
      </div>

      {question.hint && (
        <div className={gameStyles.hint}>
          <span className={gameStyles.hintIcon}>
            💡
          </span>{' '}
          Indice : {question.hint}
        </div>
      )}
    </div>
  )
}
