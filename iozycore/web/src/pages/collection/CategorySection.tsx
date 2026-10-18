import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { CoverTile } from './CoverTile'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import type { EntityTypeDto } from '@/common/types/api'
import type { ShelfTile } from './shelfTiles'

/**
 * A rail shows at most this many tiles - the rest is behind "Tout voir".
 *
 * <p>Measured on 300 series (batch 141): a rail rendered its 300 tiles, and
 * ungrouped its 3,000 volumes, in a horizontal scroll that nobody
 * goes through to the end - a second of rendering for tiles that the screen
 * will never show. The count of the rail, for its part, always says the total.
 */
export const TUILES_PAR_RAIL = 48

/**
 * One row per category that has at least one owned title (see mockup
 * V1.2 - never an empty rail: ShelfPage already filters the categories at 0
 * before reaching this component). Halo tinted by universe in the background, horizontal
 * scroll of the tiles - replaces the old filter "Tout/Manga/Jeu vidéo/
 * Jeu de société" (see docs/DESIGN_MIGRATION_V1.2.md Batch 3): the
 * split by type is now structural (one row = one type),
 * no need to choose a filter to see it.
 */
export function CategorySection({ entityType, tiles }: { entityType: EntityTypeDto; tiles: ShelfTile[] }) {
  const navigate = useNavigate()
  const visual = getEntityTypeVisual(entityType)
  const affichees = tiles.slice(0, TUILES_PAR_RAIL)

  return (
    <section
      className="relative -mx-3.5 rounded-3xl px-3.5 pt-0.5 pb-1.5"
      style={{ background: `radial-gradient(120% 90% at 0% 0%, ${visual.tint}, transparent 62%)` }}
    >
      <button
        type="button"
        onClick={() => navigate(`/collection/${entityType.id}`)}
        className="flex w-full items-center gap-2.5 py-3.5 text-left"
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: visual.color }} />
        <h2 className="font-display text-lg font-semibold text-textPrimary">{entityType.label}</h2>
        <span className="text-sm text-faint">{tiles.length}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-sm font-semibold whitespace-nowrap" style={{ color: visual.color }}>
          Tout voir
          <ChevronRight size={15} />
        </span>
      </button>
      <div className="defilement-discret flex gap-3 overflow-x-auto pb-3">
        {affichees.map((tile) => (
          <div key={tile.key} className="w-[130px] shrink-0 sm:w-[150px]">
            <CoverTile
              title={tile.title}
              subtitle={tile.subtitle}
              imageUrl={tile.imageUrl}
              gradientKey={tile.gradientKey}
              aspectClassName={visual.aspectClassName}
              signal={tile.signal}
              onClick={() => navigate(`/entity/${tile.entityId}`)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
