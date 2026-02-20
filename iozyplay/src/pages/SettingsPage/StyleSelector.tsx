import styles from './StyleSelector.module.scss'
import { useState, useEffect } from 'react'
import {
  STYLE_VARIANTS,
  VARIANT_DESCRIPTIONS,
  StyleVariant,
  loadStyleVariant,
} from '@/utils/styleVariants'

/**
 * Composant pour sélectionner et tester les différentes variantes de style
 */
export default function StyleSelector() {
  const [currentVariant, setCurrentVariant] = useState<StyleVariant>(STYLE_VARIANTS.DEFAULT)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadStyleVariant(currentVariant)
  }, [currentVariant])

  return (
    <div className={styles.wrapper}>
      <button className={styles.triggerButton} onClick={() => setIsOpen(!isOpen)}>
        🎨 Variantes ({VARIANT_DESCRIPTIONS[currentVariant].emoji})
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <h3 className={styles.title}>Choisir un style</h3>

          <div className={styles.options}>
            {Object.values(STYLE_VARIANTS).map((variant) => {
              const desc = VARIANT_DESCRIPTIONS[variant]
              const isSelected = currentVariant === variant

              return (
                <button
                  key={variant}
                  className={`${styles.optionButton} ${isSelected ? styles.selected : ''}`}
                  onClick={() => {
                    setCurrentVariant(variant)
                    setIsOpen(false)
                  }}
                >
                  <div className={styles.optionHeader}>
                    <span className={styles.optionEmoji}>{desc.emoji}</span>
                    <strong>{desc.name}</strong>
                  </div>
                  <div className={styles.optionDescription}>{desc.description}</div>
                </button>
              )
            })}
          </div>

          <button className={styles.closeButton} onClick={() => setIsOpen(false)}>
            Fermer
          </button>
        </div>
      )}
    </div>
  )
}
