import { IconType } from 'react-icons'
import { getIconById } from '../../utils/categoryIcons'

interface CategoryIconProps {
  categoryId: string
  iconId?: string // ID de l'icône si fourni directement (sinon on cherche via categoryId)
  className?: string
  size?: number | string
  title?: string
}

/**
 * Composant pour afficher l'icône d'une catégorie
 * Utilise les icônes react-icons stockées dans category.emoji
 */
export default function CategoryIcon({ 
  categoryId,
  iconId,
  className = '', 
  size = 24,
  title 
}: CategoryIconProps) {
  // Si iconId est fourni, l'utiliser directement, sinon utiliser categoryId comme fallback
  const Icon = getIconById(iconId || categoryId)
  
  return (
    <Icon 
      className={className}
      size={size}
      title={title}
      aria-label={title || `Icône de la catégorie ${categoryId}`}
    />
  )
}

