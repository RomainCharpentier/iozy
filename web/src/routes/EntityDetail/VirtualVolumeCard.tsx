import { Plus } from 'lucide-react'

/**
 * Tome sans aucune donnée catalogue (numéro déduit du nombre total de tomes
 * connu de l'édition, voir TomesGridSection.buildTiles) - un vrai placeholder
 * visuel ("Tome 3 / Manquant"), pas un simple rectangle avec un numéro nu :
 * l'utilisateur doit comprendre "cette place correspond au tome que je ne
 * possède pas encore", jamais "cette donnée est absente de la base". Aucun
 * vocabulaire technique affiché (jamais "virtuel"/"non catalogué"/"Variant" -
 * ces notions restent des détails d'implémentation, voir TomeTile.status).
 * Composant dédié plutôt qu'une branche de plus dans TomeTileView : les deux
 * gardent exactement les mêmes dimensions de carte (même aspect-[2/3]), mais
 * le virtuel a ses propres interactions (hover/focus visibles, jamais de
 * jaquette réelle à charger) qui n'ont pas de sens pour un tome catalogué.
 */
export function VirtualVolumeCard({ volumeNumber, onClick }: { volumeNumber: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ajouter le tome ${volumeNumber}`}
      className="group relative flex aspect-[2/3] flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-surface2 bg-surface2/30 px-1 text-center transition-colors hover:border-accent hover:bg-surface2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-textDim group-hover:text-textPrimary">
        Tome {volumeNumber}
      </span>
      <span className="text-[10px] text-textDim/70">Manquant</span>
      <Plus size={14} className="mt-1 text-textDim group-hover:text-accent" />
    </button>
  )
}
