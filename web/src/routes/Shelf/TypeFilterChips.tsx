import { Chip } from '../../components/Chip'
import { ENTITY_TYPES } from '../../types/entityTypes'

interface TypeFilterChipsProps {
  selectedTypeId: string | null
  onChange: (typeId: string | null) => void
}

/** "Tout" + un chip par type d'entité - filtre client-side de la grille Shelf. */
export function TypeFilterChips({ selectedTypeId, onChange }: TypeFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="Tout" isActive={selectedTypeId === null} onClick={() => onChange(null)} />
      {ENTITY_TYPES.map((type) => (
        <Chip
          key={type.id}
          label={type.label}
          isActive={selectedTypeId === type.id}
          onClick={() => onChange(type.id)}
        />
      ))}
    </div>
  )
}
