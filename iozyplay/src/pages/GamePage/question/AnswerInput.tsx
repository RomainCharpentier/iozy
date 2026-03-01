import styles from '@/pages/GamePage/question/AnswerInput.module.scss'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import * as Popover from '@radix-ui/react-popover'
import type { Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { isSolo } from '@/lib/game/gameMode'
import { getPlayerId } from '@/utils/playerId'

interface AnswerInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value?: string) => void
  disabled: boolean
  placeholder?: string
  attempts?: number
  showAttempts?: boolean
  inputRef?: (el: HTMLInputElement | null) => void
  hasSubmitted?: boolean
  allQuestions?: Question[]
  currentQuestionId?: string
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
}

export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = 'Tapez votre réponse et appuyez sur Entrée...',
  attempts,
  showAttempts = false,
  inputRef,
  hasSubmitted = false,
  allQuestions = [],
  currentQuestionId,
  isReveal = false,
  isCorrect = false,
  correctAnswer,
  onSkipVote,
  skipVotes = new Set(),
  gameMode = 'solo',
  players = [],
  isGameEnded = false,
  isMediaReady = false,
  waitingForGo = false,
}: AnswerInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(false)
  const [lastSubmittedValue, setLastSubmittedValue] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  // Générer les suggestions avec debounce léger
  useEffect(() => {
    // Fermer les suggestions si une réponse a été soumise
    if (hasSubmitted) {
      setOpen(false)
      setSelectedIndex(-1)
      setHasSelectedSuggestion(false)
      setLastSubmittedValue('')
      return
    }

    if (disabled || !value.trim() || value.length < 2) {
      setSuggestions([])
      setOpen(false)
      setHasSelectedSuggestion(false)
      return
    }

    if (!allQuestions || allQuestions.length === 0) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const searchTerm = value.toLowerCase().trim()

    // Inclure toutes les questions pour les suggestions (même la question actuelle)
    const questionsWithAnswers = allQuestions.filter((q) => q.answer && q.answer.trim().length > 0)

    const allAnswers = questionsWithAnswers
      .map((q) => q.answer.trim())
      .filter((answer, index, self) => self.indexOf(answer) === index)

    const matching = allAnswers
      .filter((answer) => answer.toLowerCase().startsWith(searchTerm))
      .slice(0, 5)

    setSuggestions(matching)
    // Ne pas rouvrir si l'utilisateur a sélectionné une suggestion puis réécrit
    if (hasSelectedSuggestion) {
      setOpen(false)
    } else if (matching.length > 0) {
      // Ouvrir seulement si la valeur actuelle est différente de celle soumise
      if (value !== lastSubmittedValue || !lastSubmittedValue) {
        setOpen(true)
      } else {
        setOpen(false)
      }
    } else {
      setOpen(false)
    }
    setSelectedIndex(-1)
  }, [value, allQuestions, currentQuestionId, disabled, hasSubmitted, hasSelectedSuggestion, lastSubmittedValue])

  // Scroll automatique vers la suggestion sélectionnée
  useEffect(() => {
    if (selectedIndex >= 0 && contentRef.current) {
      const selectedElement = contentRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    }
  }, [selectedIndex])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && selectedIndex >= 0 && suggestions[selectedIndex]) {
        const selectedSuggestion = suggestions[selectedIndex]
        setHasSelectedSuggestion(true)
        onChange(selectedSuggestion)
        setOpen(false)
        setSelectedIndex(-1)
        setLastSubmittedValue(selectedSuggestion)
        onSubmit(selectedSuggestion)
      } else {
        if (open) {
          setOpen(false)
          setSelectedIndex(-1)
        }
        setLastSubmittedValue(value)
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
      setOpen(false)
      setSelectedIndex(-1)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setHasSelectedSuggestion(true)
    onChange(suggestion)
    setOpen(false)
    setSelectedIndex(-1)
  }

  // Fermer les suggestions si une réponse a été soumise ou si on est en phase reveal
  const shouldOpen = open && suggestions.length > 0 && !hasSubmitted && !isReveal

  // Animation pour le reveal - on garde les ombres dans le CSS et on anime seulement les propriétés supportées
  const revealAnimation = isReveal
    ? {
        transition: {
          duration: 0.3,
          ease: 'easeOut' as const,
        },
      }
    : {}

  // Gestion du bouton skip
  const playerId = isSolo(gameMode) ? 'solo' : getPlayerId() || ''
  const hasVoted = skipVotes.has(playerId)
  const canSkip = Boolean(
    !isGameEnded && isMediaReady && !waitingForGo && !hasVoted && onSkipVote
  )

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
            className={`${styles.answerActions} ${isReveal ? styles.answerActionsReveal : ''} ${isReveal && hasSubmitted && isCorrect === true ? styles.answerActionsCorrect : ''} ${isReveal && hasSubmitted && isCorrect === false ? styles.answerActionsIncorrect : ''}`}
            {...revealAnimation}
          >
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  isReveal && hasSubmitted
                    ? isCorrect
                      ? 'Correct !'
                      : isCorrect === false
                        ? 'Incorrect'
                        : 'Réponse enregistrée'
                    : hasSubmitted
                      ? 'Réponse enregistrée'
                      : placeholder
                }
                value={value}
                onChange={(e) => {
                  const newValue = e.target.value
                  if (newValue.length <= 200) {
                    onChange(newValue)
                  }
                }}
                onKeyDown={handleKeyPress}
                disabled={disabled}
                maxLength={200}
                className={`${styles.input} ${disabled ? styles.inputDisabled : ''} ${hasSubmitted ? '' : ''} ${isReveal ? '' : ''} ${isReveal && hasSubmitted && isCorrect === true ? styles.inputCorrect : ''} ${isReveal && hasSubmitted && isCorrect === false ? styles.inputIncorrect : ''}`}
                aria-label="Zone de saisie de la réponse"
                aria-autocomplete="list"
                aria-expanded={shouldOpen}
                aria-controls="suggestions-list"
                autoComplete="off"
                style={hasSubmitted && !isReveal ? { paddingRight: '3rem' } : {}}
              />
              {hasSubmitted && !isReveal && (
                <span className={styles.checkIcon} title="Réponse enregistrée">
                  ✓
                </span>
              )}
            </div>
            {canSkip && (
              <button
                type="button"
                className={styles.skipBtn}
                onClick={() => {
                  setOpen(false)
                  onSkipVote?.()
                }}
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
                ⏭
              </button>
            )}
            {shouldOpen && (
              <div className={styles.suggestions}>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`${styles.suggestion} ${index === selectedIndex ? styles.suggestionActive : ''}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            {isReveal && correctAnswer && (
              <div className={`${styles.overlay} ${isCorrect === false ? styles.overlayIncorrect : ''}`}>
                <div
                  className={`${styles.overlayIcon} ${isCorrect === false ? styles.overlayIconIncorrect : ''}`}
                >
                  {isCorrect === true ? '✓' : isCorrect === false ? '✗' : '✓'}
                </div>
                <div className={styles.overlayContent}>
                  <div className={styles.overlayLabel}>Réponse correcte</div>
                  <div className={styles.overlayAnswer}>{correctAnswer}</div>
                </div>
              </div>
            )}
          </motion.div>
        </Popover.Anchor>
      </div>
    </Popover.Root>
  )
}
