import { Chip } from '../../components/Chip'
import type { EntityTypeDto } from '../../types/api'

interface TypeFilterChipsProps {
  entityTypes: EntityTypeDto[]
  selectedTypeId: string | null
  onChange: (typeId: string | null) => void
  // Nombre d'objets possédés par type ("Manga 4"), y compris 0 pour un type
  // sans rien possédé encore - voir la maquette "[Tout 4] [Manga 4] [Jeu
  // vidéo 0] [Jeu de société 0]" : rend la carte StatCard "Total"/par-type
  // redondante (le compte est déjà là), donc retirée du header de ShelfPage.
  totalCount: number
  countsByTypeId: Map<string, number>
}

/** "Tout" + un chip par type d'entité - filtre client-side de la grille Shelf. */
export function TypeFilterChips({ entityTypes, selectedTypeId, onChange, totalCount, countsByTypeId }: TypeFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="Tout" count={totalCount} isActive={selectedTypeId === null} onClick={() => onChange(null)} />
      {entityTypes.map((type) => (
        <Chip
          key={type.id}
          label={type.label}
          count={countsByTypeId.get(type.id) ?? 0}
          isActive={selectedTypeId === type.id}
          onClick={() => onChange(type.id)}
        />
      ))}
    </div>
  )
}
