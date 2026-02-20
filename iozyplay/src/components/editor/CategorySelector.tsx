import styles from './CategorySelector.module.scss'
import { useState, useMemo } from 'react'
import type { Category, CategoryInfo } from '@/types'

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
    <div className={styles.root}>
      <div className={styles.searchWrapper}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Rechercher une catégorie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setSearchQuery('')}
            title="Effacer la recherche"
          >
            ✕
          </button>
        )}
      </div>

      <div className={styles.cardsContainer}>
        {filteredCategories.length === 0 ? (
          <div className={styles.noResults}>
            <span>🔍</span>
            <span>Aucune catégorie trouvée</span>
          </div>
        ) : (
          <div className={styles.cardsGrid}>
            {filteredCategories.map((category) => {
              const isSelected = selectedCategories.includes(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                  onClick={() => toggleCategory(category.id)}
                  title={category.name}
                >
                  <span className={styles.emojiLarge} style={{ fontSize: '32px' }}>
                    {category.emoji}
                  </span>
                  <span className={styles.nameText}>{category.name}</span>
                  {isSelected && <span className={styles.selectedIndicator}>✓</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {multiple && selectedCategories.length > 0 && (
        <div className={styles.selectionCount}>
          {selectedCategories.length} catégorie{selectedCategories.length > 1 ? 's' : ''}{' '}
          sélectionnée{selectedCategories.length > 1 ? 's' : ''}
        </div>
      )}

      {required && selectedCategories.length === 0 && (
        <div className={styles.error}>
          <span className={styles.errorIcon} style={{ fontSize: '1rem' }}>
            ⚠
          </span>
          <span>Veuillez sélectionner au moins une catégorie</span>
        </div>
      )}
    </div>
  )
}
