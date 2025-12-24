import { Category } from '../../../../types'
import { CATEGORIES } from '../../../../constants/categories'
import { TIMING, QUESTION_COUNT } from '../../../../constants/timing'
import { soundManager } from '../../../../utils/sounds'

interface RoomConfigPanelProps {
  categories: Category[]
  timeLimit: number
  questionCount: number
  availableQuestionsCount: number
  onTimeLimitChange: (limit: number) => void
  onQuestionCountChange: (count: number) => void
  onStartGame: () => void
  onBack: () => void
  canStart: boolean
  startError: string | null
}

export default function RoomConfigPanel({
  categories,
  timeLimit,
  questionCount,
  availableQuestionsCount,
  onTimeLimitChange,
  onQuestionCountChange,
  onStartGame,
  onBack,
  canStart,
  startError
}: RoomConfigPanelProps) {
  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || { emoji: '🎵', name: categoryId }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <h2 className="card-title">⚙️ Configuration</h2>
      </div>

      {/* Categories */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          Thèmes sélectionnés
        </label>
        <div className="grid-auto" style={{ gap: 'var(--spacing-xs)' }}>
          {categories.map(category => {
            const catInfo = getCategoryInfo(category)
            return (
              <span key={category} className="badge badge-primary">
                {catInfo.emoji} {catInfo.name}
              </span>
            )
          })}
        </div>
      </div>

      {/* Timer Slider */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          ⏱️ Timer par question: <strong>{timeLimit}s</strong>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <input
            type="range"
            min={TIMING.MIN_TIME_LIMIT}
            max={TIMING.MAX_TIME_LIMIT}
            value={timeLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              onTimeLimitChange(value)
              soundManager.playClick()
            }}
            style={{
              flex: 1,
              height: '6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '3px',
              outline: 'none',
              WebkitAppearance: 'none'
            }}
          />
          <span style={{ minWidth: '50px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
            {timeLimit}s
          </span>
        </div>
      </div>

      {/* Question Count Slider */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          🎵 Nombre de questions: <strong>{questionCount}</strong>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <input
            type="range"
            min={QUESTION_COUNT.MIN}
            max={Math.min(QUESTION_COUNT.MAX, availableQuestionsCount)}
            value={questionCount}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              onQuestionCountChange(value)
              soundManager.playClick()
            }}
            disabled={availableQuestionsCount === 0}
            style={{
              flex: 1,
              height: '6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '3px',
              outline: 'none',
              WebkitAppearance: 'none',
              opacity: availableQuestionsCount === 0 ? 0.5 : 1
            }}
          />
          <span style={{ minWidth: '50px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
            {questionCount}
          </span>
        </div>
        <p className="text-secondary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
          {availableQuestionsCount > 0 
            ? `${availableQuestionsCount} questions disponibles`
            : 'Aucune question disponible'
          }
        </p>
      </div>

      {/* Actions */}
      <div style={{ 
        marginTop: 'auto', 
        paddingTop: 'var(--spacing-lg)', 
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: 'var(--spacing-sm)',
        justifyContent: 'flex-end'
      }}>
        <button 
          className="btn btn-secondary" 
          onClick={onBack}
        >
          ← Retour
        </button>
        <button 
          className="btn btn-primary btn-large" 
          onClick={onStartGame}
          disabled={!canStart}
        >
          ▶ Démarrer la partie
        </button>
      </div>

      {/* Error Messages */}
      {startError && (
        <div style={{ 
          marginTop: 'var(--spacing-md)', 
          padding: 'var(--spacing-sm)', 
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: '0.5rem',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--error)'
        }}>
          {startError}
        </div>
      )}
    </div>
  )
}

