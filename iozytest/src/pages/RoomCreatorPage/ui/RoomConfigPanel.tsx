import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/RoomCreatorPage/ui/RoomConfigPanel.module.scss'
import { ArrowLeft, Play } from 'lucide-react'
import { type Category, type CategoryInfo, DEFAULT_CATEGORIES } from '@/types'
import { loadCategories } from '@/services/categoryService'
import { TIMING } from '@/services/gameService'
import { soundManager } from '@/utils/sounds'
import SectionHeader from '@/components/common/SectionHeader'
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
  isStarting?: boolean
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
  startError,
  isStarting = false,
}: RoomConfigPanelProps) {
  const [categoryInfos, setCategoryInfos] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES)

  // Constantes
  const MIN_COUNT = 1
  const MAX_COUNT = 50
  const DEFAULT_COUNT = 20

  // Normaliser availableQuestionsCount - toujours un nombre >= 0
  const availableCount: number = (() => {
    if (rawAvailableCount == null || rawAvailableCount === undefined) return 0
    const num = Number(rawAvailableCount)
    if (Number.isNaN(num) || !Number.isFinite(num) || num < 0) return 0
    return Math.floor(num)
  })()

  // Calculer le max disponible : min(50, availableCount), avec minimum 1
  const maxCount: number = (() => {
    if (!Number.isFinite(availableCount) || availableCount < 0) return MIN_COUNT
    if (availableCount === 0) return MIN_COUNT
    const calculated = Math.max(MIN_COUNT, Math.min(MAX_COUNT, availableCount))
    if (Number.isNaN(calculated) || !Number.isFinite(calculated)) return MIN_COUNT
    return calculated
  })()

  // Normaliser questionCount - valeur par défaut si invalide
  const currentCount: number = (() => {
    if (!Number.isFinite(maxCount) || Number.isNaN(maxCount)) return MIN_COUNT

    if (rawQuestionCount == null || rawQuestionCount === undefined || rawQuestionCount === 0) {
      const defaultVal = Math.min(DEFAULT_COUNT, maxCount)
      return Number.isNaN(defaultVal) || !Number.isFinite(defaultVal) ? MIN_COUNT : defaultVal
    }

    const numValue = Number(rawQuestionCount)
    if (!Number.isFinite(numValue) || Number.isNaN(numValue)) {
      const defaultVal = Math.min(DEFAULT_COUNT, maxCount)
      return Number.isNaN(defaultVal) || !Number.isFinite(defaultVal) ? MIN_COUNT : defaultVal
    }

    // Si la valeur est dans la plage valide, l'utiliser
    if (numValue >= MIN_COUNT && numValue <= maxCount) {
      const rounded = Math.round(numValue)
      return Number.isNaN(rounded) || !Number.isFinite(rounded) ? MIN_COUNT : rounded
    }

    // Sinon, utiliser la valeur par défaut
    const defaultVal = Math.min(DEFAULT_COUNT, maxCount)
    return Number.isNaN(defaultVal) || !Number.isFinite(defaultVal) ? MIN_COUNT : defaultVal
  })()

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    const cats = await loadCategories()
    setCategoryInfos(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
  }

  const getCategoryInfo = (categoryId: string) => {
    return categoryInfos.find((c) => c.id === categoryId) || { emoji: 'FaMusic', name: categoryId }
  }

  const handleQuestionCountChange = (newValue: number) => {
    const val = Math.round(Number(newValue))
    if (!isNaN(val) && isFinite(val) && val >= MIN_COUNT && val <= maxCount) {
      onQuestionCountChange(val)
      soundManager.playClick()
    }
  }

  const safeCount =
    Number.isFinite(currentCount) && !Number.isNaN(currentCount) ? currentCount : MIN_COUNT
  const safeMax = Number.isFinite(maxCount) && !Number.isNaN(maxCount) ? maxCount : MIN_COUNT

  return (
    <section className={`${ds.card} ${styles.panel}`} aria-labelledby="room-config">
      <SectionHeader
        title={<span id="room-config">Configuration</span>}
        subtitle={
          availableCount > 0
            ? `${availableCount} question${availableCount > 1 ? 's' : ''} disponible${availableCount > 1 ? 's' : ''} dans ces thèmes.`
            : 'Aucune question disponible dans ces thèmes.'
        }
      />

      <div className={styles.section}>
        <span className={styles.label}>Thèmes</span>
        <div className={styles.chips}>
          {selectedCategories.map((category) => {
            const catInfo = getCategoryInfo(category)
            return (
              <span key={category} className={ds.chip}>
                <span aria-hidden="true">{catInfo.emoji}</span>
                {catInfo.name}
              </span>
            )
          })}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label} htmlFor="room-time-limit">
          Chrono par question
        </label>
        <div className={styles.sliderRow}>
          <input
            id="room-time-limit"
            type="range"
            min={TIMING.MIN_TIME_LIMIT}
            max={TIMING.MAX_TIME_LIMIT}
            step={TIMING.TIME_LIMIT_STEP}
            value={timeLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              onTimeLimitChange(value)
              soundManager.playClick()
            }}
            className={styles.slider}
          />
          <output className={styles.sliderValue} htmlFor="room-time-limit">
            {timeLimit} s
          </output>
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label} htmlFor="room-question-count">
          Nombre de questions
        </label>
        <div className={styles.sliderRow}>
          <input
            id="room-question-count"
            type="range"
            min={MIN_COUNT}
            max={safeMax}
            value={safeCount}
            onChange={(e) => handleQuestionCountChange(parseInt(e.target.value, 10))}
            disabled={availableCount === 0}
            className={styles.slider}
          />
          <output className={styles.sliderValue} htmlFor="room-question-count">
            {safeCount}
          </output>
        </div>
      </div>

      {startError && (
        <p className={styles.errorMessage} role="status">
          {startError}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={`${ds.btn} ${ds.btnTertiary}`} onClick={onBack}>
          <ArrowLeft size={15} />
          Quitter le salon
        </button>
        <button
          type="button"
          className={`${ds.btn} ${ds.btnPrimary}`}
          onClick={onStartGame}
          disabled={!canStart || isStarting}
        >
          <Play size={16} />
          {isStarting ? 'Démarrage…' : 'Démarrer la partie'}
        </button>
      </div>
    </section>
  )
}
