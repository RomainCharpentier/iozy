import { Chip } from '../../components/Chip'
import type { EntityTypeDto } from '../../types/api'

interface TypeFilterChipsProps {
  entityTypes: EntityTypeDto[]
  selectedTypeId: string | null
  onChange: (typeId: string | null) => void
}

/** "Tout" + un chip par type d'entité - filtre client-side de la grille Shelf. */
export function TypeFilterChips({ entityTypes, selectedTypeId, onChange }: TypeFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="Tout" isActive={selectedTypeId === null} onClick={() => onChange(null)} />
      {entityTypes.map((type) => (
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
