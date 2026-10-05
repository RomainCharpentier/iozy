interface ChipProps {
  label: string
  isActive?: boolean
  onClick?: () => void
  // Optional, backward compatible - shown as a discreet suffix (see
  // TypeFilterChips: "Manga 4") rather than concatenated into `label`, to
  // stay visually distinct from the type name without complicating the
  // existing uses of Chip that do not need it (tags, editions...).
  count?: number
}

/** Capsule pill - type filters (Shelf) and display of tags (EntityDetail). */
export function Chip({ label, isActive = false, onClick, count }: ChipProps) {
  const className = `inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent text-accentInk' : 'bg-surface text-textDim ring-1 ring-line'
  }`
  const content = (
    <>
      {label}
      {count !== undefined && <span className={isActive ? 'opacity-80' : 'opacity-60'}>{count}</span>}
    </>
  )

  if (onClick) {
    // Only the CLICKABLE variant carries the touch height: 28 px is easy to miss with a
    // thumb, and a missed filter costs extra taps. The display variant
    // (a tag, an edition) is not a target and would stay needlessly tall.
    return (
      <button type="button" onClick={onClick} className={`min-h-11 ${className}`}>
        {content}
      </button>
    )
  }
  return <span className={className}>{content}</span>
}
