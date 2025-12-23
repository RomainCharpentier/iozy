import { useState, useEffect } from 'react'
import { STYLE_VARIANTS, VARIANT_DESCRIPTIONS, StyleVariant, loadStyleVariant } from '../utils/styleVariants'

/**
 * Composant pour sélectionner et tester les différentes variantes de style
 * 
 * Usage : Ajoutez ce composant temporairement dans votre App.tsx pour tester
 */
export default function StyleSelector() {
  const [currentVariant, setCurrentVariant] = useState<StyleVariant>(STYLE_VARIANTS.DEFAULT)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadStyleVariant(currentVariant)
  }, [currentVariant])

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      fontFamily: 'system-ui, sans-serif'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(99, 102, 241, 0.9)',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 600,
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
        }}
      >
        🎨 Variantes ({VARIANT_DESCRIPTIONS[currentVariant].emoji})
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '50px',
          right: 0,
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          minWidth: '300px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: '#111827'
          }}>
            Choisir un style
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.values(STYLE_VARIANTS).map(variant => {
              const desc = VARIANT_DESCRIPTIONS[variant]
              const isSelected = currentVariant === variant
              
              return (
                <button
                  key={variant}
                  onClick={() => {
                    setCurrentVariant(variant)
                    setIsOpen(false)
                  }}
                  style={{
                    background: isSelected ? '#6366f1' : '#f3f4f6',
                    color: isSelected ? 'white' : '#111827',
                    border: `2px solid ${isSelected ? '#6366f1' : '#e5e7eb'}`,
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    fontWeight: isSelected ? 600 : 500
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#e5e7eb'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = '#f3f4f6'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{desc.emoji}</span>
                    <strong>{desc.name}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.25rem' }}>
                    {desc.description}
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setIsOpen(false)}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.5rem',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: '#6b7280'
            }}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  )
}



