import { RefreshCw } from 'lucide-react'

/**
 * « Actualiser depuis la source » : redemander la liste des tomes en
 * ignorant le cache du serveur (voir useTomesProposes.actualiser). Posé
 * dans les deux états de l'aperçu - aucun tome trouvé, et grille - parce
 * qu'un cache qui ne se périme jamais a besoin d'une porte de sortie
 * visible (Lot 121 : Boruto, 7 tomes en cache quand la BnF en connaissait 20).
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
