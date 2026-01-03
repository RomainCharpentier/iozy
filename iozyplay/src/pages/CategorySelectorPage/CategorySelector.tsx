import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { type Category, type CategoryInfo } from '../../services/types'
import { loadCategories } from '../../services/categoryService'
import { DEFAULT_CATEGORIES } from '../../services/types'
import type { Player } from '../../lib/game/types'
import { soundManager } from '../../utils/sounds'
import CategoryIcon from '../../components/common/CategoryIcon'

interface CategorySelectorProps {
  onStartGame: (categories: Category[], mode: 'solo' | 'online', players: Player[], playerName: string) => void | Promise<void>
  defaultMode?: 'solo' | 'online'
}

export default function CategorySelector({ onStartGame, defaultMode }: CategorySelectorProps) {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [gameMode, setGameMode] = useState<'solo' | 'online'>(defaultMode || 'solo')
  const [playerName, setPlayerName] = useState<string>('')
  const [categories, setCategories] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES)

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    const cats = await loadCategories()
    setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
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

  const handleModeSelect = (mode: 'solo' | 'online') => {
    soundManager.playClick()
    setGameMode(mode)
  }

  const handleStartGame = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie !', {
        icon: '📂',
      })
      return
    }

    const name = gameMode === 'online' ? '' : 'Joueur' // Pas de nom requis pour le mode en ligne
    const players: Player[] = gameMode === 'solo' 
      ? [{ id: 'solo', name: 'Joueur', score: 0 }]
      : []

    soundManager.playStart()
    await onStartGame(selectedCategories, gameMode, players, name)
  }

  const showModeSelector = defaultMode === undefined

  return (
    <div className="category-selector">
      {showModeSelector && (
        <>
          <h2>Créer une partie</h2>
          
          <div className="mode-selection">
            <h3>Mode de jeu</h3>
            <div className="mode-buttons">
              <button
                className={`mode-button ${gameMode === 'solo' ? 'active' : ''}`}
                onClick={() => handleModeSelect('solo')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                aria-label="Mode solo"
                aria-pressed={gameMode === 'solo'}
              >
                <span style={{ fontSize: '18px', marginRight: '0.5rem' }}>🎮</span> Solo
              </button>
              <button
                className={`mode-button ${gameMode === 'online' ? 'active' : ''}`}
                onClick={() => handleModeSelect('online')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                aria-label="Mode multijoueur en ligne"
                aria-pressed={gameMode === 'online'}
              >
                <span style={{ fontSize: '18px', marginRight: '0.5rem' }}>👥</span> Multijoueur en ligne
              </button>
            </div>
          </div>
        </>
      )}

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
        {defaultMode === undefined ? (gameMode === 'online' ? 'Créer un salon' : 'Commencer le jeu') : 'Valider les thèmes'}
      </button>
    </div>
  )
}


