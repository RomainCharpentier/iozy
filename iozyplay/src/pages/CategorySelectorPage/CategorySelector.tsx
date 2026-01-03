import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { type Category, type CategoryInfo } from '../../services/types'
import { loadCategories } from '../../services/categoryService'
import { DEFAULT_CATEGORIES } from '../../services/types'
import type { Player } from '../../lib/game/types'
import { soundManager } from '../../utils/sounds'
import CategoryIcon from '../../components/common/CategoryIcon'
import { QuestionService } from '../../services/questionService'
interface CategorySelectorProps {
  onStartGame: (categories: Category[], mode: 'solo' | 'online', players: Player[], playerName: string) => void | Promise<void>
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
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
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
    <div className="category-selector">
      <h2>Créer une partie</h2>

      {isLoadingCategories ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '200px',
          flexDirection: 'column',
          gap: 'var(--spacing-md)'
        }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary">Chargement des catégories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: 'var(--spacing-xl)',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
            Aucune catégorie avec des questions disponibles
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Ajoutez des questions dans l'éditeur pour pouvoir jouer
          </p>
        </div>
      ) : (
        <>
          <div className="categories-grid">
            {categories.map(category => (
              <button
                key={category.id}
                className={`category-card ${selectedCategories.includes(category.id) ? 'selected' : ''}`}
                onClick={() => toggleCategory(category.id)}
                aria-label={`${selectedCategories.includes(category.id) ? 'Désélectionner' : 'Sélectionner'} la catégorie ${category.name}`}
                aria-pressed={selectedCategories.includes(category.id)}
              >
                <span className="category-emoji">
                  <CategoryIcon categoryId={category.id} iconId={category.emoji} size={32} />
                </span>
                <span className="category-name">{category.name}</span>
              </button>
            ))}
          </div>
          <button
            className="start-button"
            onClick={handleStartGame}
            disabled={selectedCategories.length === 0}
            aria-label={selectedCategories.length === 0 ? 'Sélectionnez au moins une catégorie pour commencer' : 'Commencer la partie'}
          >
            Continuer
          </button>
        </>
      )}
    </div>
  )
}


