interface ChipProps {
  label: string
  isActive?: boolean
  onClick?: () => void
  // Optionnel, rétrocompatible - affiché en suffixe discret (voir
  // TypeFilterChips : "Manga 4") plutôt que concaténé dans `label`, pour
  // rester visuellement distinct du nom du type sans complexifier les
  // usages existants de Chip qui n'en ont pas besoin (tags, éditions...).
  count?: number
}

/** Pastille capsule - filtres de type (Shelf) et affichage de tags (EntityDetail). */
export function Chip({ label, isActive = false, onClick, count }: ChipProps) {
  const className = `inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent text-accentText' : 'bg-surface text-textDim'
  }`
  const content = (
    <>
      {label}
      {count !== undefined && <span className={isActive ? 'opacity-80' : 'opacity-60'}>{count}</span>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }
  return <span className={className}>{content}</span>
}
