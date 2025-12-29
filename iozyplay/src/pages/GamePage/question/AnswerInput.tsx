import { soundManager } from '../../../utils/sounds'

interface AnswerInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  placeholder?: string
  attempts?: number
  showAttempts?: boolean
  inputRef?: (el: HTMLInputElement | null) => void
}

export default function AnswerInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Tapez votre réponse et appuyez sur Entrée...",
  attempts,
  showAttempts = false,
  inputRef
}: AnswerInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSubmit()
    }
  }

  return (
    <div className="answer-input-container">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        className={`answer-input ${disabled ? 'disabled' : ''}`}
        aria-label="Zone de saisie de la réponse"
        autoComplete="off"
      />
      {showAttempts && attempts !== undefined && attempts > 0 && (
        <div className="attempts-counter">
          {attempts} tent.
        </div>
      )}
    </div>
  )
}

