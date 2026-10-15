import gameStyles from '@/pages/GamePage/Game.module.scss'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo, isOnline } from '@/lib/game/gameMode'
import MediaPlayer from '@/components/media/MediaPlayer'
import { isYouTubeUrl } from '@/utils/youtube'
import AnswerInput from '@/pages/GamePage/question/AnswerInput'
import MediaSyncOverlay from '@/pages/GamePage/question/MediaSyncOverlay'
import { TIMING } from '@/services/gameService'
import { getPlayerId } from '@/utils/playerId'
import { getQuestionStartTime } from '@/utils/timecode'
import CategoryIcon from '@/components/common/CategoryIcon'
import type { CategoryInfo } from '@/types'
import { DEFAULT_CATEGORIES } from '@/types'
import { loadCategories } from '@/services/categoryService'
import {
  useAnswerAutoSend,
  AUTO_SEND_DELAY_MS,
  AUTO_SEND_IMMEDIATE_THRESHOLD_S,
} from '@/pages/GamePage/question/useAnswerAutoSend'
import type { AnswerSaveStatus } from '@/pages/GamePage/question/AnswerInput'

interface QuestionCardProps {
  question: Question
  onAnswer: (answer: string, timeRemaining: number, playerId?: string) => void // Contenu du champ (envoi automatique)
  onSkipVote?: () => void // Fonction pour voter skip
  gameMode?: GameMode
  players?: Player[]
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
  answerSuggestions?: string[] // Réponses proposées en autocomplétion
  revealedAnswer?: string // Bonne réponse reçue du serveur au reveal (mode multijoueur)
  validatedAnswers?: Record<string, boolean> // Réponses validées par le serveur (mode multijoueur)
  muted?: boolean // Son du média coupé localement (bouton « Son » de la barre du haut)
  answerAckPending?: boolean // En ligne : une réponse envoyée attend l'accusé du serveur
}

export default function QuestionCard({
  question,
  onAnswer,
  onSkipVote,
  gameMode = 'solo',
  players = [],
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
  answerSuggestions = [],
  revealedAnswer,
  validatedAnswers = {},
  muted = false,
  answerAckPending = false,
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

  // Contenu du champ = réponse du joueur (une seule par question, modifiable jusqu'au reveal)
  const [userAnswer, setUserAnswer] = useState<string>('')
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

  // Résultat du joueur, connu seulement après la validation de fin de guess (aucun retour
  // juste/faux avant le reveal) : serveur en ligne, validateAnswers du solo sinon.
  const currentPlayerId = isOnline(gameMode) ? getPlayerId() : 'solo'
  const isCurrentPlayerCorrect = isOnline(gameMode)
    ? currentPlayerId
      ? validatedAnswers[currentPlayerId]
      : undefined
    : correctPlayers.has('solo')

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

  // Envoi automatique : en ligne avec un court délai (immédiat près de la fin du chrono),
  // en solo à chaque modification (stockage local, synchrone, lu par validateAnswers).
  const isGuessActive = !isRevealPhase && !isGameEnded
  const sendImmediately =
    isSolo(gameMode) || (timeRemaining > 0 && timeRemaining <= AUTO_SEND_IMMEDIATE_THRESHOLD_S)
  const autoSend = useAnswerAutoSend({
    active: isGuessActive,
    delayMs: sendImmediately ? 0 : AUTO_SEND_DELAY_MS,
    send: (answer) => onAnswer(answer, timeRemaining),
  })

  // Entrée ou suggestion choisie : envoi immédiat, le champ reste modifiable
  const handleSubmit = (answerValue?: string) => {
    if (isRevealPhase) return
    const answer = answerValue !== undefined ? answerValue : userAnswer
    if (answerValue !== undefined) setUserAnswer(answerValue)
    autoSend.submit(answer)
  }

  const handleAnswerChange = (value: string) => {
    if (isRevealPhase) return
    setUserAnswer(value)
    autoSend.update(value)
  }

  // La saisie en attente part AVANT le vote : le serveur valide dès que le vote est
  // unanime, et traite les messages d'un même socket dans l'ordre d'émission.
  const handleSkipVote = onSkipVote
    ? () => {
        autoSend.flush()
        onSkipVote()
      }
    : undefined

  const trimmedAnswer = userAnswer.trim()
  const saveStatus: AnswerSaveStatus =
    trimmedAnswer === ''
      ? 'empty'
      : autoSend.hasPending || autoSend.lastSent !== trimmedAnswer || answerAckPending
        ? 'pending'
        : 'saved'

  // Libellé au singulier pour les catégories par défaut ; catégorie personnalisée : son nom
  const getCategoryLabel = (category: string | string[]) => {
    const categoryStr = Array.isArray(category) ? category[0] : category
    const labels: Record<string, string> = {
      series: 'Série TV',
      animes: 'Animé',
      chansons: 'Chanson',
      films: 'Film',
      jeux: 'Jeu vidéo',
    }
    return labels[categoryStr] || getCategoryInfo(categoryStr)?.name || 'Média'
  }

  const getCategoryId = (category: string | string[]) => {
    return Array.isArray(category) ? category[0] : category
  }

  const getCategoryInfo = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)
  }

  // Au reveal d'une vidéo (fichier ou YouTube), la scène média adopte un ratio 16:9
  const isVideoReveal =
    isRevealPhase && (question.type === 'video' || isYouTubeUrl(question.mediaUrl))

  const categoryId = getCategoryId(question.category)
  const categoryInfo = getCategoryInfo(categoryId)

  return (
    <div className={`${gameStyles.questionCard} ${gameStyles.questionCardGameInterfaceGame}`}>
      <div className={gameStyles.gameInterfaceGameHeader}>
        <div className={gameStyles.gameInterfaceCategory}>
          <span className={gameStyles.gameInterfaceCategoryIcon} aria-hidden="true">
            <CategoryIcon categoryId={categoryId} iconId={categoryInfo?.emoji} size={20} />
          </span>
          <span className={gameStyles.gameInterfaceCategoryText}>
            <span className={gameStyles.visuallyHidden}>Catégorie : </span>
            {getCategoryLabel(question.category)}
          </span>
        </div>
      </div>

      <div
        className={`${gameStyles.mediaContainer} ${gameStyles.gameInterfaceMedia}`}
        data-testid="media-container"
      >
        {question.mediaUrl && (
          <>
            {waitingForGo && isOnline(gameMode) && gameStep !== 'playing' && (
              <MediaSyncOverlay gameStep={gameStep} mediaReady={mediaReady} />
            )}
            {/* Scène du lecteur : passe en 16:9 contraint par la hauteur au reveal vidéo */}
            <div
              className={`${gameStyles.mediaStage} ${isVideoReveal ? gameStyles.mediaStageVideo : ''}`}
            >
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
                startSeconds={getQuestionStartTime(question)}
                startFraction={question.startFraction}
                mediaDuration={question.duration}
                muted={muted}
              />
            </div>
          </>
        )}
      </div>

      <div className={gameStyles.gameInterfaceAnswer}>
        {isSolo(gameMode) ? (
          <>
            <AnswerInput
              value={userAnswer}
              onChange={handleAnswerChange}
              onSubmit={handleSubmit}
              disabled={isRevealPhase}
              inputRef={(el) => {
                inputRefs.current['solo'] = el
              }}
              saveStatus={saveStatus}
              suggestionPool={answerSuggestions}
              isReveal={isRevealPhase}
              isCorrect={isRevealPhase ? isCurrentPlayerCorrect : undefined}
              correctAnswer={isRevealPhase ? question.answer : undefined}
              onSkipVote={handleSkipVote}
              skipVotes={skipVotes}
              gameMode={gameMode}
              players={players}
              isGameEnded={isGameEnded}
              isMediaReady={isMediaReady}
              waitingForGo={waitingForGo}
              revealSecondsRemaining={isRevealPhase ? timeRemaining : undefined}
              revealDurationSeconds={
                isRevealPhase ? question.timeLimit || TIMING.DEFAULT_TIME_LIMIT : undefined
              }
            />
          </>
        ) : (
          <>
            <AnswerInput
              value={userAnswer}
              onChange={handleAnswerChange}
              onSubmit={handleSubmit}
              // Modifiable pendant tout le guess (même après envoi), figé seulement au reveal
              disabled={isRevealPhase}
              inputRef={(el) => {
                inputRefs.current['online'] = el
              }}
              saveStatus={saveStatus}
              suggestionPool={answerSuggestions}
              isReveal={isRevealPhase}
              isCorrect={isRevealPhase ? isCurrentPlayerCorrect : undefined}
              correctAnswer={isRevealPhase ? revealedAnswer : undefined}
              onSkipVote={handleSkipVote}
              skipVotes={skipVotes}
              gameMode={gameMode}
              players={players}
              isGameEnded={isGameEnded}
              isMediaReady={isMediaReady}
              waitingForGo={waitingForGo}
              revealSecondsRemaining={isRevealPhase ? timeRemaining : undefined}
              revealDurationSeconds={
                isRevealPhase ? question.timeLimit || TIMING.DEFAULT_TIME_LIMIT : undefined
              }
            />
          </>
        )}
      </div>

      {question.hint && (
        <p className={gameStyles.hint} role="note">
          <span className={gameStyles.hintIcon} aria-hidden="true">
            💡
          </span>
          <span className={gameStyles.hintLabel}>Indice :</span> {question.hint}
        </p>
      )}
    </div>
  )
}
