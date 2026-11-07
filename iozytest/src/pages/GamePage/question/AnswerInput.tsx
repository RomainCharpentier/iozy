import styles from '@/pages/GamePage/question/AnswerInput.module.scss'
import { useState, useEffect, useId, useRef } from 'react'
import { motion } from 'motion/react'
import * as Popover from '@radix-ui/react-popover'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo } from '@/lib/game/gameMode'
import { getPlayerId } from '@/utils/playerId'
import { getSkipButtonState } from '@/pages/GamePage/question/skipButton'
import { normalizeAnswer } from '@/utils/answerNormalization'

/**
 * État d'enregistrement de la réponse (envoi automatique, voir useAnswerAutoSend) :
 * - empty : champ vide, rien d'enregistré ;
 * - pending : la saisie affichée n'est pas encore enregistrée (délai ou envoi en cours) ;
 * - saved : le contenu du champ est la réponse enregistrée (toujours modifiable).
 */
export type AnswerSaveStatus = 'empty' | 'pending' | 'saved'

type RevealResult = 'correct' | 'incorrect' | 'none'

const REVEAL_RESULT: Record<RevealResult, { icon: string; title: string }> = {
  correct: { icon: '✓', title: 'Bien joué !' },
  incorrect: { icon: '✗', title: 'Raté !' },
  none: { icon: '⏱', title: 'Pas de réponse' },
}

interface AnswerInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value?: string) => void
  /** Champ figé (reveal) : rendu en lecture seule pour garder le focus clavier */
  disabled: boolean
  placeholder?: string
  inputRef?: (el: HTMLInputElement | null) => void
  saveStatus?: AnswerSaveStatus
  suggestionPool?: string[] // Réponses possibles (sans lien avec la question en cours)
  isReveal?: boolean // Indique si on est en phase reveal
  isCorrect?: boolean | undefined // Indique si la réponse est correcte (pour le feedback visuel, uniquement pendant le reveal)
  correctAnswer?: string // La réponse correcte à afficher dans l'overlay pendant le reveal
  onSkipVote?: () => void
  skipVotes?: Set<string>
  gameMode?: GameMode
  players?: Player[]
  isGameEnded?: boolean
  isMediaReady?: boolean
  waitingForGo?: boolean
  revealSecondsRemaining?: number // Temps restant pendant le reveal avant passage automatique
  revealDurationSeconds?: number // Durée totale du reveal, pour calculer la mini-barre de progression
}

export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = 'Tapez votre réponse…',
  inputRef,
  saveStatus = 'empty',
  suggestionPool = [],
  isReveal = false,
  isCorrect,
  correctAnswer,
  onSkipVote,
  skipVotes = new Set(),
  gameMode = 'solo',
  players = [],
  isGameEnded = false,
  isMediaReady = false,
  waitingForGo = false,
  revealSecondsRemaining,
  revealDurationSeconds,
}: AnswerInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  // Valeur pour laquelle la liste a été fermée (suggestion choisie, Entrée, Échap) :
  // elle ne se rouvre qu'à la prochaine modification du champ, qui reste toujours éditable.
  const [dismissedValue, setDismissedValue] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const hintId = useId()
  const optionId = (index: number) => `${listboxId}-option-${index}`

  // Suggestions : préfixe sur le pool, recalculées à chaque modification
  useEffect(() => {
    if (disabled || !value.trim() || value.length < 2 || suggestionPool.length === 0) {
      setSuggestions([])
      setOpen(false)
      setSelectedIndex(-1)
      return
    }

    // Même normalisation que la validation : sans accents, majuscules ni ponctuation
    // (« pokemon » propose « Pokémon »). La saisie peut être n'importe où dans la réponse
    // (« aruto » → « Naruto », « titans » → « L'Attaque des Titans ») ; classement :
    // début de la réponse, puis début d'un mot, puis milieu d'un mot.
    const searchTerm = normalizeAnswer(value)
    const rank = (answer: string) => {
      const normalized = normalizeAnswer(answer)
      if (normalized.startsWith(searchTerm)) return 0
      if (normalized.split(/[\s'-]+/).some((word) => word.startsWith(searchTerm))) return 1
      return normalized.includes(searchTerm) ? 2 : -1
    }
    const matching = searchTerm
      ? suggestionPool
          .map((answer) => ({ answer, rank: rank(answer) }))
          .filter(({ rank }) => rank >= 0)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 5)
          .map(({ answer }) => answer)
      : []

    setSuggestions(matching)
    setOpen(matching.length > 0 && value !== dismissedValue)
    setSelectedIndex(-1)
  }, [value, suggestionPool, disabled, dismissedValue])

  // Scroll automatique vers la suggestion sélectionnée
  useEffect(() => {
    if (selectedIndex >= 0 && contentRef.current) {
      const selectedElement = contentRef.current.children[selectedIndex] as HTMLElement
      // scrollIntoView absent de jsdom
      selectedElement?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [selectedIndex])

  const closeSuggestions = (forValue: string) => {
    setDismissedValue(forValue)
    setOpen(false)
    setSelectedIndex(-1)
  }

  // Choix d'une suggestion (clavier ou souris) : remplit le champ et l'envoie tout de
  // suite ; le champ garde le focus et reste modifiable.
  const chooseSuggestion = (suggestion: string) => {
    closeSuggestions(suggestion)
    onChange(suggestion)
    onSubmit(suggestion)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && selectedIndex >= 0 && suggestions[selectedIndex]) {
        chooseSuggestion(suggestions[selectedIndex])
      } else {
        closeSuggestions(value)
        onSubmit()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (open && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
      } else if (suggestions.length > 0) {
        setOpen(true)
        setSelectedIndex(0)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
      } else if (suggestions.length > 0) {
        setOpen(true)
        setSelectedIndex(suggestions.length - 1)
      }
    } else if (e.key === 'Escape') {
      if (open) closeSuggestions(value)
    }
  }

  // Jamais de suggestions pendant le reveal
  const shouldOpen = open && suggestions.length > 0 && !isReveal && !disabled
  const hasAnswer = value.trim().length > 0
  // Résultat affiché au reveal : champ vide = pas de réponse, sinon juste ou faux
  const revealResult: RevealResult = !hasAnswer
    ? 'none'
    : isCorrect === true
      ? 'correct'
      : 'incorrect'

  // Animation pour le reveal - on garde les ombres dans le CSS et on anime seulement les propriétés supportées
  const revealAnimation = isReveal
    ? {
        transition: {
          duration: 0.3,
          ease: 'easeOut' as const,
        },
      }
    : {}

  // Bouton « Passer » / « Suivant » : vote en ligne (tous les joueurs connectés), direct en solo
  const solo = isSolo(gameMode)
  const playerId = solo ? 'solo' : getPlayerId() || ''
  const connectedIds = new Set(players.filter((p) => p.connected !== false).map((p) => p.id))
  const baseSkip = getSkipButtonState({
    solo,
    isReveal,
    ready: !isGameEnded && isMediaReady && !waitingForGo,
    hasVoted: !solo && skipVotes.has(playerId),
    // Seuls les votes des joueurs encore connectés comptent (un joueur parti ou
    // déconnecté reste dans skipVotes côté serveur mais ne fait plus partie du total)
    votes: [...skipVotes].filter((id) => connectedIds.has(id)).length,
    total: connectedIds.size,
  })
  // Le bouton « Passer » devient « Suivant » au même endroit dès le passage en reveal :
  // un double-clic impatient sur « Passer » (très courant en fin de chrono) peut donc
  // atterrir, sans que le joueur l'ait voulu, sur « Suivant » et sauter la révélation
  // avant même qu'il l'ait lue. On verrouille brièvement « Suivant » à l'entrée du reveal.
  // Initialisé à isReveal (pas à false) : un montage qui démarre déjà en reveal
  // (rejoint en cours de partie, remontage) ne doit pas déclencher le verrou, qui ne
  // protège que contre une vraie transition guess → reveal pendant que le joueur regarde.
  const wasRevealRef = useRef(isReveal)
  const [revealJustStarted, setRevealJustStarted] = useState(false)
  useEffect(() => {
    if (isReveal && !wasRevealRef.current) {
      setRevealJustStarted(true)
      const timeoutId = window.setTimeout(() => setRevealJustStarted(false), 700)
      wasRevealRef.current = isReveal
      return () => window.clearTimeout(timeoutId)
    }
    wasRevealRef.current = isReveal
  }, [isReveal])
  const skip = {
    ...baseSkip,
    disabled: baseSkip.disabled || (isReveal && revealJustStarted),
    title: isReveal && revealJustStarted ? 'La réponse vient de s’afficher…' : baseSkip.title,
  }
  const showSkip = Boolean(onSkipVote) && !isGameEnded

  return (
    <Popover.Root
      open={shouldOpen}
      onOpenChange={(newOpen) => {
        setOpen(newOpen)
      }}
    >
      <div className={styles.answerInputWrapper}>
        <Popover.Anchor asChild>
          <motion.div
            className={`${styles.answerActions} ${isReveal ? styles.answerActionsReveal : ''} ${isReveal && hasAnswer && isCorrect === true ? styles.answerActionsCorrect : ''} ${isReveal && hasAnswer && isCorrect === false ? styles.answerActionsIncorrect : ''}`}
            {...revealAnimation}
          >
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                placeholder={isReveal ? 'Pas de réponse' : placeholder}
                value={value}
                onChange={(e) => {
                  const newValue = e.target.value
                  if (newValue.length <= 200) {
                    onChange(newValue)
                  }
                }}
                onKeyDown={handleKeyPress}
                // Figé au reveal : lecture seule plutôt que disabled, pour que le focus
                // clavier reste sur le champ (un champ désactivé le perd au profit de <body>)
                readOnly={disabled}
                aria-disabled={disabled || undefined}
                maxLength={200}
                className={`${styles.input} ${disabled ? styles.inputDisabled : ''} ${isReveal && hasAnswer && isCorrect === true ? styles.inputCorrect : ''} ${isReveal && hasAnswer && isCorrect === false ? styles.inputIncorrect : ''} ${!isReveal && saveStatus !== 'empty' ? styles.inputWithStatus : ''}`}
                aria-label="Votre réponse"
                aria-describedby={hintId}
                aria-autocomplete="list"
                aria-expanded={shouldOpen}
                aria-controls={listboxId}
                aria-activedescendant={
                  shouldOpen && selectedIndex >= 0 ? optionId(selectedIndex) : undefined
                }
                autoComplete="off"
              />
              {/* Indication permanente (lue avec le champ), pas d'annonce à chaque frappe */}
              <span id={hintId} className={styles.visuallyHidden}>
                {isReveal
                  ? isCorrect === true
                    ? 'Réponse correcte.'
                    : isCorrect === false
                      ? 'Réponse incorrecte.'
                      : ''
                  : 'Votre réponse est enregistrée automatiquement et reste modifiable jusqu’à la fin du temps.'}
              </span>
              {!isReveal && saveStatus === 'saved' && (
                <span
                  className={styles.checkIcon}
                  title="Réponse enregistrée (modifiable jusqu’à la fin du temps)"
                  aria-hidden="true"
                  data-testid="answer-status-saved"
                >
                  ✓
                </span>
              )}
              {!isReveal && saveStatus === 'pending' && (
                <span
                  className={`${styles.checkIcon} ${styles.checkIconPending}`}
                  title="Enregistrement de la réponse…"
                  aria-hidden="true"
                  data-testid="answer-status-pending"
                >
                  …
                </span>
              )}
            </div>
            {showSkip && (
              <button
                type="button"
                className={`${styles.skipBtn} ${skip.disabled ? styles.skipBtnDisabled : ''}`}
                onClick={() => {
                  closeSuggestions(value)
                  onSkipVote?.()
                }}
                disabled={skip.disabled}
                title={skip.title}
                aria-label={`${skip.label} (${skip.title})`}
                data-testid="skip-button"
              >
                <span className={styles.skipIcon} aria-hidden="true">
                  {skip.icon}
                </span>
                <span className={styles.skipLabel}>{skip.label}</span>
                <span className={styles.skipShortLabel} aria-hidden="true">
                  {skip.shortLabel}
                </span>
              </button>
            )}
            {shouldOpen && (
              <div
                className={styles.suggestions}
                role="listbox"
                id={listboxId}
                aria-label="Suggestions"
                ref={contentRef}
              >
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`${styles.suggestion} ${index === selectedIndex ? styles.suggestionActive : ''}`}
                    onClick={() => chooseSuggestion(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(e) => {
                      // Garder le focus dans le champ
                      e.preventDefault()
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            {isReveal && correctAnswer && (
              // Résultat du joueur + rappel de la bonne réponse. Le style suit le résultat :
              // un bandeau vert « succès » quand on s'est trompé laissait croire qu'on avait gagné.
              <motion.div
                className={`${styles.overlay} ${styles[`overlay_${revealResult}`]}`}
                data-testid="reveal-result"
                data-result={revealResult}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <motion.div
                  className={styles.overlayIcon}
                  aria-hidden="true"
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.05 }}
                >
                  {REVEAL_RESULT[revealResult].icon}
                </motion.div>
                <div className={styles.overlayContent}>
                  <div className={styles.overlayTitle}>{REVEAL_RESULT[revealResult].title}</div>
                  <div className={styles.overlayAnswerLine}>
                    <span className={styles.overlayLabel}>
                      {revealResult === 'correct' ? 'La réponse :' : 'La bonne réponse :'}
                    </span>{' '}
                    <span className={styles.overlayAnswer}>{correctAnswer}</span>
                  </div>
                </div>
                {typeof revealSecondsRemaining === 'number' &&
                  typeof revealDurationSeconds === 'number' &&
                  revealDurationSeconds > 0 && (
                    <div
                      className={styles.overlayProgressTrack}
                      role="progressbar"
                      aria-label="Temps restant avant la question suivante"
                      aria-valuemin={0}
                      aria-valuemax={revealDurationSeconds}
                      aria-valuenow={Math.max(0, Math.round(revealSecondsRemaining))}
                    >
                      <div
                        className={styles.overlayProgressFill}
                        style={{
                          width: `${Math.max(0, Math.min(100, (revealSecondsRemaining / revealDurationSeconds) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
              </motion.div>
            )}
          </motion.div>
        </Popover.Anchor>
      </div>
    </Popover.Root>
  )
}
