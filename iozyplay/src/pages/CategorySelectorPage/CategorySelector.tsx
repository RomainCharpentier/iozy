import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './CategorySelector.module.scss'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { type Category, type CategoryInfo, DEFAULT_CATEGORIES } from '@/types'
import { loadCategories } from '@/services/categoryService'
import type { Player } from '@/lib/game/types'
import { soundManager } from '@/utils/sounds'
import CategoryIcon from '@/components/common/CategoryIcon'
import { QuestionService } from '@/services/questionService'
interface CategorySelectorProps {
  onStartGame: (
    categories: Category[],
    mode: 'solo' | 'online',
    players: Player[],
    playerName: string
  ) => void | Promise<void>
}

export default function CategorySelector({ onStartGame }: CategorySelectorProps) {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [playerName, setPlayerName] = useState<string>('')
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    setIsLoadingCategories(true)
    try {
      const allCats = await loadCategories()
      const cats = allCats.length > 0 ? allCats : DEFAULT_CATEGORIES

      // Filtrer les catégories qui n'ont pas de questions
      const categoriesWithQuestions = await Promise.all(
        cats.map(async (cat) => {
          const questions = await QuestionService.getQuestionsForCategories([cat.id])
          return { category: cat, hasQuestions: questions.length > 0 }
        })
      )

      // Ne garder que les catégories avec des questions
      const filteredCategories = categoriesWithQuestions
        .filter(({ hasQuestions }) => hasQuestions)
        .map(({ category }) => category)

      setCategories(filteredCategories.length > 0 ? filteredCategories : [])
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
      setCategories([])
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const toggleCategory = (category: Category) => {
    soundManager.playClick() // Son de clic
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  const handleStartGame = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie !', {
        icon: '📂',
      })
      return
    }

    const name = 'Joueur'
    const players: Player[] = [{ id: 'solo', name: 'Joueur', score: 0 }]

    soundManager.playStart()
    await onStartGame(selectedCategories, 'solo', players, name)
  }

  return (
    <div className={styles.categorySelector}>
      <h2>Créer une partie</h2>

      {isLoadingCategories ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} style={{ margin: '0 auto' }}></div>
          <p className={ds.textSecondary}>Chargement des catégories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className={styles.emptyState}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
            Aucune catégorie avec des questions disponibles
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Ajoutez des questions dans l'éditeur pour pouvoir jouer
          </p>
        </div>
      ) : (
        <>
          <div className={styles.categoriesGrid}>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`${styles.categoryCard} ${selectedCategories.includes(category.id) ? styles.selected : ''}`}
                onClick={() => toggleCategory(category.id)}
                aria-label={`${selectedCategories.includes(category.id) ? 'Désélectionner' : 'Sélectionner'} la catégorie ${category.name}`}
                aria-pressed={selectedCategories.includes(category.id)}
              >
                <span className={styles.categoryEmoji}>
                  <CategoryIcon categoryId={category.id} iconId={category.emoji} size={32} />
                </span>
                <span className={styles.categoryName}>{category.name}</span>
              </button>
            ))}
          </div>
          <button
            className={styles.startButton}
            onClick={handleStartGame}
            disabled={selectedCategories.length === 0}
            aria-label={
              selectedCategories.length === 0
                ? 'Sélectionnez au moins une catégorie pour commencer'
                : 'Commencer la partie'
            }
          >
            Continuer
          </button>
        </>
      )}
    </div>
  )
}
