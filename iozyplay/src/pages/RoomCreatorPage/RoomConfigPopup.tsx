import { useState, useEffect } from 'react'
import { type Category, type Question, type CategoryInfo } from '../../services/types'
import { loadCategories } from '../../services/categoryService'
import { DEFAULT_CATEGORIES } from '../../services/types'
import CategorySelector from '../CategorySelectorPage/CategorySelector'
import { soundManager } from '../../utils/sounds'
import { QuestionService } from '../../services/questionService'

interface RoomConfigPopupProps {
  isOpen: boolean
  currentCategories: Category[]
  currentQuestions?: Question[]
  onSave: (categories: Category[], questions: Question[], defaultTimeLimit: number) => void
  onClose: () => void
  roomCode: string
}

export default function RoomConfigPopup({ 
  isOpen, 
  currentCategories,
  currentQuestions = [],
  onSave, 
  onClose,
  roomCode 
}: RoomConfigPopupProps) {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>(currentCategories)
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [categories, setCategories] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES)
  
  // Initialiser le timer avec la valeur actuelle des questions ou 5 par défaut
  const getCurrentTimeLimit = () => {
    if (currentQuestions.length > 0 && currentQuestions[0].timeLimit) {
      return currentQuestions[0].timeLimit
    }
    return 5
  }
  
  const [defaultTimeLimit, setDefaultTimeLimit] = useState<number>(getCurrentTimeLimit())

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    const cats = await loadCategories()
    setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
  }

  useEffect(() => {
    setSelectedCategories(currentCategories)
    // Initialiser le timer avec la valeur actuelle des questions ou 5 par défaut
    if (currentQuestions.length > 0 && currentQuestions[0].timeLimit) {
      setDefaultTimeLimit(currentQuestions[0].timeLimit)
    } else {
      setDefaultTimeLimit(5)
    }
  }, [currentCategories, currentQuestions])

  if (!isOpen) return null

  const handleCategorySelected = async (categories: Category[], mode: 'solo' | 'online', players: any[], name: string) => {
    if (categories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !')
      return
    }

    // Récupérer les questions des catégories sélectionnées
    const allQuestions = await QuestionService.getQuestionsForCategories(categories)

    if (allQuestions.length === 0) {
      alert('Aucune question disponible pour les catégories sélectionnées !')
      return
    }

    // Mélanger les questions
    const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)

    setSelectedCategories(categories)
    setShowCategorySelector(false)
    soundManager.playClick()
  }

  const handleSave = async () => {
    if (selectedCategories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !')
      return
    }

    // Récupérer les questions des catégories sélectionnées
    const allQuestions = await QuestionService.getQuestionsForCategories(selectedCategories)

    if (allQuestions.length === 0) {
      alert('Aucune question disponible pour les catégories sélectionnées !')
      return
    }

    // Mélanger les questions
    const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)

    // Appliquer le timer par défaut à toutes les questions
    const questionsWithTimer = QuestionService.applyDefaultTimeLimit(shuffledQuestions, defaultTimeLimit)

    soundManager.playStart()
    onSave(selectedCategories, questionsWithTimer, defaultTimeLimit)
  }


  return (
    <>
      <div 
        className="room-config-overlay"
        onClick={onClose}
      />
      <div className="room-config-popup">
        <div className="room-config-popup-content">
          <div className="room-config-header">
            <h2>⚙️ Configuration du salon</h2>
            <p className="room-code-display-small">Salon: {roomCode}</p>
          </div>

          <div className="room-config-section">
            <h3>🎯 Thèmes sélectionnés</h3>
            {selectedCategories.length === 0 ? (
              <p className="no-categories">Aucun thème sélectionné</p>
            ) : (
              <div className="selected-categories-list">
                {selectedCategories.map(category => {
                  const catInfo = categories.find(c => c.id === category)
                  return (
                    <div key={category} className="selected-category-badge">
                      <span className="category-emoji">{catInfo?.emoji || '🎵'}</span>
                      <span className="category-name">{catInfo?.name || category}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              className="config-button secondary"
              onClick={() => {
                soundManager.playClick()
                setShowCategorySelector(true)
              }}
            >
              {selectedCategories.length === 0 ? 'Sélectionner des thèmes' : 'Modifier les thèmes'}
            </button>
          </div>

          {showCategorySelector && (
            <div className="category-selector-inline">
              <div className="category-selector-header">
                <h3>Sélectionner les thèmes</h3>
                <button
                  className="close-inline-button"
                  onClick={() => {
                    soundManager.playClick()
                    setShowCategorySelector(false)
                  }}
                >
                  ✕
                </button>
              </div>
              <CategorySelector
                onStartGame={handleCategorySelected}
                defaultMode="online"
              />
            </div>
          )}

          <div className="room-config-section">
            <h3>⏱️ Timer par question</h3>
            <div className="timer-config">
              <label className="timer-config-label">
                Durée (en secondes)
                <input
                  type="number"
                  min="3"
                  max="60"
                  value={defaultTimeLimit}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 3 && value <= 60) {
                      setDefaultTimeLimit(value)
                      soundManager.playClick()
                    }
                  }}
                  className="timer-input"
                />
              </label>
              <div className="timer-preview">
                <span className="timer-value">{defaultTimeLimit}s</span>
                <span className="timer-hint">par question</span>
              </div>
            </div>
          </div>

          <div className="room-config-actions">
            <button
              className="config-button secondary"
              onClick={() => {
                soundManager.playClick()
                onClose()
              }}
            >
              Annuler
            </button>
            <button
              className="config-button primary"
              onClick={handleSave}
              disabled={selectedCategories.length === 0}
            >
              💾 Enregistrer et relancer
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

