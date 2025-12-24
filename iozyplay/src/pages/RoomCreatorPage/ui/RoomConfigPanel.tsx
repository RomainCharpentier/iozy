import { type Category, type CategoryInfo } from '../../../services/types'
import { loadCategories } from '../../../services/categoryService'
import { DEFAULT_CATEGORIES } from '../../../services/types'
import { TIMING } from '../../../services/gameService'
import { soundManager } from '../../../utils/sounds'
import { useState, useEffect } from 'react'

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
  categories: selectedCategories,
  timeLimit,
  questionCount: rawQuestionCount,
  availableQuestionsCount: rawAvailableCount,
  onTimeLimitChange,
  onQuestionCountChange,
  onStartGame,
  onBack,
  canStart,
  startError
}: RoomConfigPanelProps) {
  const [categoryInfos, setCategoryInfos] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES)

  // Constantes
  const MIN_COUNT = 1
  const MAX_COUNT = 50
  const DEFAULT_COUNT = 20

  // Normaliser availableQuestionsCount - toujours un nombre >= 0
  const availableCount = Math.max(0, Number(rawAvailableCount) || 0)

  // Calculer le max disponible : min(50, availableCount), avec minimum 1
  const maxCount = availableCount === 0 ? MIN_COUNT : Math.max(MIN_COUNT, Math.min(MAX_COUNT, availableCount))

  // Normaliser questionCount - valeur par défaut si invalide
  const currentCount = (() => {
    const numValue = Number(rawQuestionCount)
    // Si la valeur est un nombre valide dans la plage [MIN_COUNT, maxCount], l'utiliser
    if (!isNaN(numValue) && isFinite(numValue) && numValue >= MIN_COUNT && numValue <= maxCount) {
      return Math.round(numValue)
    }
    // Sinon, utiliser la valeur par défaut (20 ou maxCount si moins de 20)
    return Math.min(DEFAULT_COUNT, maxCount)
  })()

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    const cats = await loadCategories()
    setCategoryInfos(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
  }

  const getCategoryInfo = (categoryId: string) => {
    return categoryInfos.find(c => c.id === categoryId) || { emoji: '🎵', name: categoryId }
  }

  const handleQuestionCountChange = (newValue: number) => {
    const val = Math.round(Number(newValue))
    if (!isNaN(val) && isFinite(val) && val >= MIN_COUNT && val <= maxCount) {
      onQuestionCountChange(val)
      soundManager.playClick()
    }
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
          {selectedCategories.map(category => {
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
          🎵 Nombre de questions: <strong>{currentCount}</strong>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <input
            type="range"
            min={MIN_COUNT}
            max={maxCount}
            value={currentCount}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              handleQuestionCountChange(value)
            }}
            disabled={availableCount === 0}
            style={{
              flex: 1,
              height: '6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '3px',
              outline: 'none',
              WebkitAppearance: 'none',
              opacity: availableCount === 0 ? 0.5 : 1
            }}
          />
          <span style={{ minWidth: '50px', textAlign: 'center', fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>
            {currentCount}
          </span>
        </div>
        <p className="text-secondary" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
          {availableCount > 0
            ? `${availableCount} questions disponibles`
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
