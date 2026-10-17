interface CategoryIconProps {
  categoryId: string
  iconId?: string // Emoji de la catégorie
  className?: string
  size?: number | string
  title?: string
}

/**
 * Composant pour afficher l'emoji d'une catégorie
 */
export default function CategoryIcon({
  categoryId,
  iconId,
  className = '',
  size = 24,
  title,
}: CategoryIconProps) {
  const emoji = iconId || categoryId

  return (
    <span
      className={className}
      style={{ fontSize: typeof size === 'number' ? `${size}px` : size }}
      title={title}
      aria-label={title || `Emoji de la catégorie ${categoryId}`}
    >
      {emoji}
    </span>
  )
}
