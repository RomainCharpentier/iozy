import { useState, useEffect, useRef } from 'react'
import * as Popover from '@radix-ui/react-popover'
import type { Question } from '../../../services/types'
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
  currentQuestionId
}: AnswerInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastSubmittedValueRef = useRef<string>('') // Valeur au moment où on a appuyé sur Enter

  // Générer les suggestions avec debounce léger
  useEffect(() => {
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
  }, [value, allQuestions, currentQuestionId, disabled])

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
    // Soumettre automatiquement la suggestion sélectionnée
    // Passer directement la valeur sélectionnée pour éviter les problèmes de timing
    setTimeout(() => {
      onSubmit(suggestion)
    }, 50)
  }

  const shouldOpen = open && suggestions.length > 0

  return (
    <Popover.Root open={shouldOpen} onOpenChange={(newOpen) => {
      setOpen(newOpen)
    }}>
      <div className="answer-input-wrapper">
        <Popover.Anchor asChild>
          <div className="answer-input-container">
            <input
              ref={inputRef}
              type="text"
              placeholder={hasSubmitted ? "Réponse enregistrée" : placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={disabled}
              className={`answer-input ${disabled ? 'disabled' : ''} ${hasSubmitted ? 'submitted' : ''}`}
              aria-label="Zone de saisie de la réponse"
              aria-autocomplete="list"
              aria-expanded={shouldOpen}
              aria-controls="suggestions-list"
              autoComplete="off"
            />
            {hasSubmitted && (
              <span className="answer-check-icon" title="Réponse enregistrée">✓</span>
            )}
            {showAttempts && attempts !== undefined && attempts > 0 && !hasSubmitted && (
              <div className="attempts-counter">
                {attempts} tent.
              </div>
            )}
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            ref={contentRef}
            id="suggestions-list"
            className="answer-suggestions-popover"
            sideOffset={4}
            align="start"
            side="bottom"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={() => {
              setOpen(false)
              setSelectedIndex(-1)
            }}
            onPointerDownOutside={(e) => {
              // Ne pas fermer si on clique sur l'input
              const target = e.target as HTMLElement
              if (target.closest('.answer-input-container')) {
                e.preventDefault()
              }
            }}
          >
            {suggestions.length > 0 ? (
              <>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion}
                    role="option"
                    aria-selected={index === selectedIndex}
                    className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(e) => {
                      // Empêcher le blur de l'input
                      e.preventDefault()
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
                <Popover.Arrow className="popover-arrow" />
              </>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
        {/* Debug visuel temporaire */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            fontSize: '10px', 
            color: '#666', 
            marginTop: '4px', 
            padding: '4px', 
            background: '#000', 
            borderRadius: '4px',
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 99999
          }}>
            Debug: shouldOpen={String(shouldOpen)}, open={String(open)}, suggestions={suggestions.length}, 
            value="{value}", disabled={String(disabled)}, hasSubmitted={String(hasSubmitted)},
            allQuestions={allQuestions?.length || 0}
            {suggestions.length > 0 && (
              <div style={{ marginTop: '4px', color: '#0f0' }}>
                Suggestions: {suggestions.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </Popover.Root>
  )
}
