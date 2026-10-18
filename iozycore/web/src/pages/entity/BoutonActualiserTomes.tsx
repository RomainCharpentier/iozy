import { RefreshCw } from 'lucide-react'

/**
 * "Actualiser depuis la source": ask again for the list of volumes,
 * ignoring the server cache (see useTomesProposes.actualiser). Placed
 * in both states of the preview - no volume found, and grid - because
 * a cache that never expires needs a visible way out
 * (Batch 121: Boruto, 7 volumes in cache when the BnF knew 20).
 */
export function BoutonActualiserTomes({ enCours, onClick }: { enCours: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={enCours}
      className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
    >
      <RefreshCw size={13} className={enCours ? 'animate-spin' : undefined} />
      {enCours ? 'Actualisation…' : 'Actualiser depuis la source'}
    </button>
  )
}
