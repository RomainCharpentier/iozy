interface ChipProps {
  label: string
  isActive?: boolean
  onClick?: () => void
}

/** Pastille capsule - filtres de type (Shelf) et affichage de tags (EntityDetail). */
export function Chip({ label, isActive = false, onClick }: ChipProps) {
  const className = `inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent text-accentText' : 'bg-surface text-textDim'
  }`

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {label}
      </button>
    )
  }
  return <span className={className}>{label}</span>
}
