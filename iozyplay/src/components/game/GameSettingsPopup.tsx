import { useState, useEffect } from 'react'
import { Category, Question } from '../../types'
import CategorySelector from '../menu/CategorySelector'
import { soundManager } from '../../utils/sounds'
import { QuestionService } from '../../services/questionService'
import { CATEGORIES } from '../../constants/categories'
import { TIMING } from '../../constants/timing'
import { QUESTION_COUNT } from '../../constants/timing'

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

    useEffect(() => {
        setSelectedCategories(currentCategories)
        setTimeLimit(currentTimeLimit)
        setQuestionCount(currentQuestionCount)
        const available = QuestionService.getQuestionsForCategories(currentCategories)
        setAvailableQuestionsCount(available.length)
    }, [currentCategories, currentTimeLimit, currentQuestionCount])

    useEffect(() => {
        const available = QuestionService.getQuestionsForCategories(selectedCategories)
        setAvailableQuestionsCount(available.length)
        if (available.length > 0 && questionCount > available.length) {
            setQuestionCount(Math.min(questionCount, available.length))
        }
    }, [selectedCategories])

    if (!isOpen) return null

    const handleCategorySelected = (categories: Category[]) => {
        if (categories.length === 0) {
            alert('Veuillez sélectionner au moins une catégorie !')
            return
        }

        const allQuestions = QuestionService.getQuestionsForCategories(categories)

        if (allQuestions.length === 0) {
            alert('Aucune question disponible pour les catégories sélectionnées !')
            return
        }

        setSelectedCategories(categories)
        setShowCategorySelector(false)
        soundManager.playClick()
    }

    const handleSave = () => {
        if (selectedCategories.length === 0) {
            alert('Veuillez sélectionner au moins une catégorie !')
            return
        }

        const allQuestions = QuestionService.getQuestionsForCategories(selectedCategories)

        if (allQuestions.length === 0) {
            alert('Aucune question disponible pour les catégories sélectionnées !')
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
                <h2>⚙️ Modifier les paramètres</h2>
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
                <h3>🎯 Thèmes</h3>
                {selectedCategories.length === 0 ? (
                    <p className="no-categories">Aucun thème sélectionné</p>
                ) : (
                    <div className="selected-categories-list">
                        {selectedCategories.map(category => {
                            const catInfo = CATEGORIES.find(c => c.id === category)
                            return (
                                <div key={category} className="selected-category-badge">
                                    <span className="category-emoji">{catInfo?.emoji}</span>
                                    <span className="category-name">{catInfo?.name}</span>
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
                        defaultMode={gameMode}
                    />
                </div>
            )}

            <div className="game-settings-section">
                <h3>⏱️ Timer par question</h3>
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
                <h3>🎵 Nombre de chansons</h3>
                <div className="timer-config">
                    <label className="timer-config-label">
                        Nombre de questions
                        <input
                            type="range"
                            min={QUESTION_COUNT.MIN}
                            max={Math.min(QUESTION_COUNT.MAX, availableQuestionsCount)}
                            value={questionCount}
                            onChange={(e) => {
                                const value = parseInt(e.target.value)
                                setQuestionCount(value)
                                soundManager.playClick()
                            }}
                            className="timer-slider"
                            disabled={availableQuestionsCount === 0}
                        />
                    </label>
                    <div className="timer-preview">
                        <span className="timer-value">{questionCount}</span>
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

