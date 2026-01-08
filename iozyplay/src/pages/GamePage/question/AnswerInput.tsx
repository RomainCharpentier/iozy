import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import type { Question } from '../../../types'
import type { GameMode, Player } from '../../../lib/game/types'
import { getPlayerId } from '../../../utils/playerId'
import '../../../styles/answer-input.css'

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
  placeholder = "Tapez votre réponse et appuyez sur Entrée...",
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
  waitingForGo = false
}: AnswerInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastSubmittedValueRef = useRef<string>('') // Valeur au moment où on a appuyé sur Enter

  // Générer les suggestions avec debounce léger
  useEffect(() => {
    // Fermer les suggestions si une réponse a été soumise
    if (hasSubmitted) {
      setOpen(false)
      setSelectedIndex(-1)
      return
    }

    if (disabled || !value.trim() || value.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    if (!allQuestions || allQuestions.length === 0) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const searchTerm = value.toLowerCase().trim()
    
    // Inclure toutes les questions pour les suggestions (même la question actuelle)
    // car on veut pouvoir suggérer toutes les réponses possibles
    const questionsWithAnswers = allQuestions.filter(q => q.answer && q.answer.trim().length > 0)
    
    const allAnswers = questionsWithAnswers
      .map(q => q.answer.trim())
      .filter((answer, index, self) => self.indexOf(answer) === index)

    const matching = allAnswers
      .filter(answer => answer.toLowerCase().startsWith(searchTerm))
      .slice(0, 5)

    setSuggestions(matching)
    // Les suggestions réapparaissent automatiquement quand value change et correspond
    // Mais seulement si la valeur a vraiment changé depuis la dernière soumission (Enter)
    if (matching.length > 0) {
      // Ouvrir seulement si la valeur actuelle est différente de celle qu'on avait au moment d'Enter
      // ou si on n'a jamais soumis (lastSubmittedValueRef est vide)
      if (value !== lastSubmittedValueRef.current || !lastSubmittedValueRef.current) {
        setOpen(true)
      } else {
        // Même valeur qu'au moment d'Enter, ne pas rouvrir
        setOpen(false)
      }
    } else {
      setOpen(false)
    }
    setSelectedIndex(-1)
  }, [value, allQuestions, currentQuestionId, disabled, hasSubmitted])

  // Scroll automatique vers la suggestion sélectionnée
  useEffect(() => {
    if (selectedIndex >= 0 && contentRef.current) {
      const selectedElement = contentRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [selectedIndex])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Si une suggestion est sélectionnée, l'utiliser
      if (open && selectedIndex >= 0 && suggestions[selectedIndex]) {
        e.preventDefault()
        const selectedSuggestion = suggestions[selectedIndex]
        // Mettre à jour la valeur d'abord, puis soumettre après un court délai
        // pour laisser le temps au state de se mettre à jour
        onChange(selectedSuggestion)
        setOpen(false)
        setSelectedIndex(-1)
        // Mémoriser la valeur soumise pour éviter de rouvrir immédiatement
        lastSubmittedValueRef.current = selectedSuggestion
        // Soumettre automatiquement la suggestion sélectionnée
        // Passer directement la valeur sélectionnée pour éviter les problèmes de timing
        setTimeout(() => {
          onSubmit(selectedSuggestion)
        }, 50)
      } else {
        // Sinon, soumettre la réponse actuelle et fermer les suggestions
        if (open) {
          setOpen(false)
          setSelectedIndex(-1)
        }
        // Mémoriser la valeur soumise pour éviter de rouvrir immédiatement
        lastSubmittedValueRef.current = value
        onSubmit()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (open && suggestions.length > 0) {
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
      } else if (suggestions.length > 0) {
        setOpen(true)
        setSelectedIndex(0)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open && suggestions.length > 0) {
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
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
    onChange(suggestion)
    setOpen(false)
    setSelectedIndex(-1)
    // Mémoriser la valeur soumise pour éviter de rouvrir immédiatement
    lastSubmittedValueRef.current = suggestion
    // Soumettre automatiquement la suggestion sélectionnée
    // Passer directement la valeur sélectionnée pour éviter les problèmes de timing
    setTimeout(() => {
      onSubmit(suggestion)
    }, 50)
  }

  // Fermer les suggestions si une réponse a été soumise ou si on est en phase reveal
  const shouldOpen = open && suggestions.length > 0 && !hasSubmitted && !isReveal

  // Animation pour le reveal - on garde les ombres dans le CSS et on anime seulement les propriétés supportées
  const revealAnimation = isReveal ? {
    transition: {
      duration: 0.3,
      ease: 'easeOut' as const
    }
  } : {}

  // Gestion du bouton skip
  const playerId = gameMode === 'solo' ? 'solo' : (getPlayerId() || '')
  const hasVoted = skipVotes.has(playerId)
  const canSkip = !isGameEnded && isMediaReady && !waitingForGo && !hasVoted && onSkipVote

  return (
    <Popover.Root open={shouldOpen} onOpenChange={(newOpen) => {
      setOpen(newOpen)
    }}>
      <div className="answer-input-wrapper">
        <Popover.Anchor asChild>
          <motion.div 
            className={`game-interface-answer-actions variant-4 ${isReveal ? 'reveal' : ''} ${isReveal && hasSubmitted && isCorrect === true ? 'correct' : ''} ${isReveal && hasSubmitted && isCorrect === false ? 'incorrect' : ''}`}
            {...revealAnimation}
          >
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder={isReveal && hasSubmitted ? (isCorrect ? "Correct !" : isCorrect === false ? "Incorrect" : "Réponse enregistrée") : hasSubmitted ? "Réponse enregistrée" : placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={disabled}
                className={`game-interface-input with-skip ${disabled ? 'disabled' : ''} ${hasSubmitted ? 'submitted' : ''} ${isReveal ? 'reveal' : ''} ${isReveal && hasSubmitted && isCorrect === true ? 'correct' : ''} ${isReveal && hasSubmitted && isCorrect === false ? 'incorrect' : ''}`}
                aria-label="Zone de saisie de la réponse"
                aria-autocomplete="list"
                aria-expanded={shouldOpen}
                aria-controls="suggestions-list"
                autoComplete="off"
                style={hasSubmitted && !isReveal ? { paddingRight: '3rem' } : {}}
              />
              {hasSubmitted && !isReveal && (
                <span className="game-interface-check-icon" title="Réponse enregistrée">✓</span>
              )}
            </div>
            {canSkip && (
              <button
                className="game-interface-skip variant-4"
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
                ⏭
              </button>
            )}
            {shouldOpen && (
              <div className="game-interface-suggestions">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`game-interface-suggestion ${index === selectedIndex ? 'active' : ''}`}
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
              <div className={`game-interface-overlay ${isCorrect === false ? 'incorrect' : ''}`}>
                <div className={`game-interface-overlay-icon ${isCorrect === false ? 'incorrect' : ''}`}>
                  {isCorrect === true ? '✓' : isCorrect === false ? '✗' : '✓'}
                </div>
                <div className="game-interface-overlay-content">
                  <div className="game-interface-overlay-label">Réponse correcte</div>
                  <div className="game-interface-overlay-answer">{correctAnswer}</div>
                </div>
              </div>
            )}
          </motion.div>
        </Popover.Anchor>
      </div>
    </Popover.Root>
  )
}
