import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { type Category, type Question, type CategoryInfo, DEFAULT_CATEGORIES } from '../../../types'
import { loadCategories } from '../../../services/categoryService'
import CategorySelector from '../../CategorySelectorPage/CategorySelector'
import { soundManager } from '../../../utils/sounds'
import { QuestionService } from '../../../services/questionService'
import { TIMING, QUESTION_COUNT } from '../../../services/gameService'
import CategoryIcon from '../../../components/common/CategoryIcon'

interface GameSettingsPopupProps {
    isOpen: boolean
    currentCategories: Category[]
    currentTimeLimit?: number
    currentQuestionCount?: number
    onSave: (categories: Category[], questions: Question[], timeLimit: number, questionCount: number) => void
    onClose: () => void
    gameMode: 'solo' | 'online'
}

export default function GameSettingsPopup({
    isOpen,
    currentCategories,
    currentTimeLimit = TIMING.DEFAULT_TIME_LIMIT,
    currentQuestionCount = QUESTION_COUNT.DEFAULT,
    onSave,
    onClose,
    gameMode
}: GameSettingsPopupProps) {
    const [selectedCategories, setSelectedCategories] = useState<Category[]>(currentCategories)
    const [showCategorySelector, setShowCategorySelector] = useState(false)
    const [timeLimit, setTimeLimit] = useState<number>(currentTimeLimit)
    const [questionCount, setQuestionCount] = useState<number>(currentQuestionCount)
    const [availableQuestionsCount, setAvailableQuestionsCount] = useState<number>(0)
    const [categories, setCategories] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES)

    useEffect(() => {
        loadCategoriesList()
    }, [])

    useEffect(() => {
        setSelectedCategories(currentCategories)
        setTimeLimit(currentTimeLimit)
        setQuestionCount(currentQuestionCount)
        loadAvailableQuestions()
    }, [currentCategories, currentTimeLimit, currentQuestionCount])

    const loadCategoriesList = async () => {
        const cats = await loadCategories()
        setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
    }

    const loadAvailableQuestions = async () => {
        const available = await QuestionService.getQuestionsForCategories(currentCategories)
        setAvailableQuestionsCount(available.length)
    }

    useEffect(() => {
        const updateAvailableQuestions = async () => {
            const available = await QuestionService.getQuestionsForCategories(selectedCategories)
            setAvailableQuestionsCount(available.length)
            if (available.length > 0) {
                const maxCount = Math.min(QUESTION_COUNT.MAX, available.length)
                if (questionCount > maxCount) {
                    setQuestionCount(Math.max(QUESTION_COUNT.MIN, maxCount))
                } else if (questionCount < QUESTION_COUNT.MIN) {
                    setQuestionCount(QUESTION_COUNT.MIN)
                }
            }
        }
        updateAvailableQuestions()
    }, [selectedCategories])

    if (!isOpen) return null

    const handleCategorySelected = async (categories: Category[]) => {
        if (categories.length === 0) {
            toast.error('Veuillez sélectionner au moins une catégorie !', {
                icon: '📂',
            })
            return
        }

        const allQuestions = await QuestionService.getQuestionsForCategories(categories)

        if (allQuestions.length === 0) {
            toast.error('Aucune question disponible pour les catégories sélectionnées !', {
                icon: '❌',
            })
            return
        }

        setSelectedCategories(categories)
        setShowCategorySelector(false)
        soundManager.playClick()
    }

    const handleSave = async () => {
        if (selectedCategories.length === 0) {
            toast.error('Veuillez sélectionner au moins une catégorie !', {
                icon: '📂',
            })
            return
        }

        const allQuestions = await QuestionService.getQuestionsForCategories(selectedCategories)

        if (allQuestions.length === 0) {
            toast.error('Aucune question disponible pour les catégories sélectionnées !', {
                icon: '❌',
            })
            return
        }

        const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)
        const actualCount = Math.min(questionCount, shuffledQuestions.length)
        const limitedQuestions = shuffledQuestions.slice(0, actualCount)
        const questionsWithTimer = QuestionService.applyDefaultTimeLimit(limitedQuestions, timeLimit)

        soundManager.playStart()
        onSave(selectedCategories, questionsWithTimer, timeLimit, actualCount)
    }

    return (
        <div className="game-settings-popup">
            <div className="game-settings-header">
                <h2>Modifier les paramètres</h2>
                <button
                    className="close-button"
                    onClick={() => {
                        soundManager.playClick()
                        onClose()
                    }}
                >
                    ✕
                </button>
            </div>

            <div className="game-settings-section">
                <h3>Thèmes</h3>
                {selectedCategories.length === 0 ? (
                    <p className="no-categories">Aucun thème sélectionné</p>
                ) : (
                    <div className="selected-categories-list">
                        {selectedCategories.map(category => {
                            const catInfo = categories.find(c => c.id === category)
                            return (
                                <div key={category} className="selected-category-badge">
                                    <span className="category-emoji">
                                      <CategoryIcon categoryId={category} iconId={catInfo?.emoji} size={20} />
                                    </span>
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
                        onStartGame={(categories, _mode, _players, _name) => handleCategorySelected(categories)}
                    />
                </div>
            )}

            <div className="game-settings-section">
                <h3>Timer par question</h3>
                <div className="timer-config">
                    <label className="timer-config-label">
                        Durée (en secondes)
                        <input
                            type="range"
                            min={TIMING.MIN_TIME_LIMIT}
                            max={TIMING.MAX_TIME_LIMIT}
                            value={timeLimit}
                            onChange={(e) => {
                                const value = parseInt(e.target.value)
                                setTimeLimit(value)
                                soundManager.playClick()
                            }}
                            className="timer-slider"
                        />
                    </label>
                    <div className="timer-preview">
                        <span className="timer-value">{timeLimit}s</span>
                        <span className="timer-hint">par question</span>
                    </div>
                </div>
            </div>

            <div className="game-settings-section">
                <h3>Nombre de questions</h3>
                <div className="timer-config">
                    <label className="timer-config-label">
                        Nombre de questions
                        <input
                            type="range"
                            min={QUESTION_COUNT.MIN}
                            max={Math.min(QUESTION_COUNT.MAX, availableQuestionsCount)}
                            value={typeof questionCount === 'number' && !isNaN(questionCount) ? questionCount : QUESTION_COUNT.MIN}
                            onChange={(e) => {
                                const value = parseInt(e.target.value, 10)
                                if (!isNaN(value) && value >= QUESTION_COUNT.MIN) {
                                    setQuestionCount(value)
                                    soundManager.playClick()
                                }
                            }}
                            className="timer-slider"
                            disabled={availableQuestionsCount === 0}
                        />
                    </label>
                    <div className="timer-preview">
                        <span className="timer-value">{typeof questionCount === 'number' && !isNaN(questionCount) ? questionCount : QUESTION_COUNT.MIN}</span>
                        <span className="timer-hint">
                            {availableQuestionsCount > 0
                                ? `sur ${availableQuestionsCount} disponibles`
                                : 'questions'
                            }
                        </span>
                    </div>
                </div>
            </div>

            <div className="game-settings-actions">
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
    )
}

