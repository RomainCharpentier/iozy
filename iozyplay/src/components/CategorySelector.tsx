import { useState } from 'react'
import { Category } from '../types'
import { soundManager } from '../utils/sounds'

interface CategorySelectorProps {
  onStartGame: (categories: Category[], mode: 'solo' | 'online', players: Player[], playerName: string) => void
  defaultMode?: 'solo' | 'online'
}

interface Player {
  id: string
  name: string
  score: number
}

const categories: { id: Category; name: string; emoji: string }[] = [
  { id: 'chansons', name: 'Chansons', emoji: '🎵' },
  { id: 'series', name: 'Séries TV', emoji: '📺' },
  { id: 'animes', name: 'Animes', emoji: '🎌' },
  { id: 'films', name: 'Films', emoji: '🎬' },
  { id: 'jeux', name: 'Jeux vidéo', emoji: '🎮' },
]

export default function CategorySelector({ onStartGame, defaultMode }: CategorySelectorProps) {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [gameMode, setGameMode] = useState<'solo' | 'online'>(defaultMode || 'solo')
  const [playerName, setPlayerName] = useState<string>('')

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

  const handleStartGame = () => {
    if (selectedCategories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !')
      return
    }

    const name = gameMode === 'online' ? '' : 'Joueur' // Pas de nom requis pour le mode en ligne
    const players: Player[] = gameMode === 'solo' 
      ? [{ id: 'solo', name: 'Joueur', score: 0 }]
      : []

    soundManager.playStart()
    onStartGame(selectedCategories, gameMode, players, name)
  }

  // Afficher le sélecteur de mode seulement si defaultMode n'est pas défini
  const showModeSelector = defaultMode === undefined
  
  console.log('🎯 [CategorySelector] defaultMode:', defaultMode, 'showModeSelector:', showModeSelector)

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
              >
                🎮 Solo
              </button>
              <button
                className={`mode-button ${gameMode === 'online' ? 'active' : ''}`}
                onClick={() => handleModeSelect('online')}
              >
                🌐 Multijoueur en ligne
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
          >
            <span className="category-emoji">{category.emoji}</span>
            <span className="category-name">{category.name}</span>
          </button>
        ))}
      </div>
      <button
        className="start-button"
        onClick={handleStartGame}
        disabled={selectedCategories.length === 0}
      >
        {defaultMode === undefined ? (gameMode === 'online' ? 'Créer un salon' : 'Commencer le jeu') : 'Valider les thèmes'}
      </button>
    </div>
  )
}


