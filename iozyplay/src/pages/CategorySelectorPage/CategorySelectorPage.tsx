import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/CategorySelectorPage/CategorySelectorPage.module.scss'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useGameState } from '@/lib/game/GameContext'
import CategorySelector from '@/pages/CategorySelectorPage/CategorySelector'
import type { Category } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'
import { QuestionService } from '@/services/questionService'

export default function CategorySelectorPage() {
  const navigate = useNavigate()
  const { setGameState } = useGameState()
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)

  const handleStartGame = async (
    categories: Category[],
    mode: GameMode,
    configuredPlayers: Player[],
    name: string
  ) => {
    if (categories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie !', {
        icon: '📂',
      })
      return
    }

    setIsLoadingQuestions(true)
    try {
      const allQuestions = await QuestionService.getQuestionsForCategories(categories)

      if (allQuestions.length === 0) {
        toast.error('Aucune question disponible pour les catégories sélectionnées !', {
          icon: '❌',
        })
        return
      }

      const shuffledQuestions = QuestionService.shuffleQuestions(allQuestions)

      setGameState({
        categories,
        questions: shuffledQuestions,
        gameMode: mode,
        players: configuredPlayers.map((p) => ({ ...p, score: 0 })),
        playerName: name,
      })

      // Utiliser la même interface pour solo et multijoueur
      navigate('/room/create')
    } catch (error) {
      console.error('Erreur lors du chargement des questions:', error)
      toast.error('Erreur lors du chargement des questions', {
        icon: '⚠️',
      })
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  return (
    <>
      <header className={styles.appHeader}>
        <button className={styles.editorToggleButton} onClick={() => navigate('/')}>
          ← Retour au menu
        </button>
      </header>
      {isLoadingQuestions ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} style={{ margin: '0 auto' }}></div>
          <p className={ds.textSecondary}>Chargement des questions...</p>
        </div>
      ) : (
        <CategorySelector onStartGame={handleStartGame} />
      )}
    </>
  )
}
