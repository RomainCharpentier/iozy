import { useState, useMemo } from 'react'
import type { Category, CategoryInfo } from '@/types'
import '../../styles/category-selector.css'

interface CategorySelectorProps {
  categories: CategoryInfo[]
  selectedCategories: Category[]
  onSelectionChange: (categories: Category[]) => void
  multiple?: boolean
  required?: boolean
}

export default function CategorySelector({
  categories,
  selectedCategories,
  onSelectionChange,
  multiple = true,
  required = true,
}: CategorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrer les catégories selon la recherche
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories
    }
    const query = searchQuery.toLowerCase().trim()
    return categories.filter(
      (cat) => cat.name.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query)
    )
  }, [categories, searchQuery])

  const toggleCategory = (categoryId: Category) => {
    if (multiple) {
      // Sélection multiple
      if (selectedCategories.includes(categoryId)) {
        // En mode multiple, on peut désélectionner
        const newSelection = selectedCategories.filter((id) => id !== categoryId)
        onSelectionChange(newSelection)
      } else {
        onSelectionChange([...selectedCategories, categoryId])
      }
    } else {
      // Sélection unique : si déjà sélectionné, on ne fait rien (toujours au moins une sélection)
      // Sinon, on sélectionne cette catégorie
      if (!selectedCategories.includes(categoryId)) {
        onSelectionChange([categoryId])
      }
    }
  }

  return (
    <div className="category-selector-editor">
      {/* Champ de recherche */}
      <div className="category-search-wrapper">
        <input
          type="text"
          className="category-search-input"
          placeholder="🔍 Rechercher une catégorie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="category-search-clear"
            onClick={() => setSearchQuery('')}
            title="Effacer la recherche"
          >
            ✕
          </button>
        )}
      </div>

      {/* Grille avec scroll */}
      <div className="category-cards-container">
        {filteredCategories.length === 0 ? (
          <div className="category-no-results">
            <span>🔍</span>
            <span>Aucune catégorie trouvée</span>
          </div>
        ) : (
          <div className="category-cards-grid">
            {filteredCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`category-card-editor ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleCategory(category.id)}
                  title={category.name}
                >
                  <span className="category-emoji-large" style={{ fontSize: '32px' }}>
                    {category.emoji}
                  </span>
                  <span className="category-name-text">{category.name}</span>
                  {isSelected && <span className="selected-indicator">✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Compteur de sélection */}
      {multiple && selectedCategories.length > 0 && (
        <div className="category-selection-count">
          {selectedCategories.length} catégorie{selectedCategories.length > 1 ? 's' : ''}{' '}
          sélectionnée{selectedCategories.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Message d'erreur si requis et aucune sélection */}
      {required && selectedCategories.length === 0 && (
        <div className="category-selector-error">
          <span className="error-icon" style={{ fontSize: '1rem' }}>
            ⚠
          </span>
          <span>Veuillez sélectionner au moins une catégorie</span>
        </div>
      )}
    </div>
  )
}
