import type { ReactNode } from 'react'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import type { EntityTypeDto } from '@/common/types/api'

/**
 * The grid of the catalogue (lot 198): covers of 150 px at least, as many
 * per row as the width allows - seven at 1,280 px, nine at 1,600 - and three
 * on a phone, like a shelf. `items-start`: a tile holds its own height, so
 * the heart pinned at its foot stays with its text and not at the bottom
 * of the tallest tile of the row.
 */
export const CLASSE_GRILLE_CATALOGUE =
  'grid grid-cols-3 items-start gap-3 md:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:gap-4'

/**
 * The works of one universe on the catalogue.
 *
 * <p>At rest, one shelf per universe, with the same halo and the same header
 * as a row of Ma collection: the split by type is structural, not a
 * filter to choose. During a search, the same grid without the halo, named
 * only when several universes answered - the eyebrow above ("Déjà dans
 * IozyCore", "Suggestions") already says what the block is.
 */
export function RayonCatalogue({
  entityType,
  nombre,
  compact = false,
  nommer = true,
  children,
}: {
  entityType: EntityTypeDto
  nombre: number
  /** Without halo nor big header: a group of search results. */
  compact?: boolean
  /** In compact form, whether the universe is named above the grid. */
  nommer?: boolean
  children: ReactNode
}) {
  const visual = getEntityTypeVisual(entityType)
  if (compact) {
    return (
      <section className="flex flex-col gap-1.5">
        {nommer && <h2 className="text-xs font-medium text-textDim">{entityType.label}</h2>}
        <div className={CLASSE_GRILLE_CATALOGUE}>{children}</div>
      </section>
    )
  }
  return (
    <section
      className="relative -mx-3.5 rounded-3xl px-3.5 pt-0.5 pb-3.5"
      style={{ background: `radial-gradient(120% 90% at 0% 0%, ${visual.tint}, transparent 62%)` }}
    >
      <div className="flex items-center gap-2.5 py-3.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: visual.color }} />
        <h2 className="font-display text-lg font-semibold text-textPrimary">{entityType.label}</h2>
        <span className="text-sm text-faint">{nombre}</span>
      </div>
      <div className={CLASSE_GRILLE_CATALOGUE}>{children}</div>
    </section>
  )
}
