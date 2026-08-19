import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { CoverTile } from '../../components/CoverTile'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import type { EntityTypeDto } from '../../types/api'
import type { ShelfTile } from './shelfTiles'

/**
 * Une ligne par catégorie ayant au moins un titre possédé (voir la maquette
 * V1.2 - jamais de rail vide : ShelfPage filtre déjà les catégories à 0
 * avant d'atteindre ce composant). Halo teinté par univers en fond, scroll
 * horizontal des tuiles - remplace l'ancien filtre "Tout/Manga/Jeu vidéo/
 * Jeu de société" (voir docs/DESIGN_MIGRATION_V1.2.md Lot 3) : la
 * répartition par type est maintenant structurelle (une ligne = un type),
 * plus besoin de choisir un filtre pour la voir.
 */
export function CategorySection({ entityType, tiles }: { entityType: EntityTypeDto; tiles: ShelfTile[] }) {
  const navigate = useNavigate()
  const visual = getEntityTypeVisual(entityType.code)

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
      <div className="flex gap-3 overflow-x-auto pb-3.5">
        {tiles.map((tile) => (
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
