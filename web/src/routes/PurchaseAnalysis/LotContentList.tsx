import { X } from 'lucide-react'

/**
 * La liste canonique du lot : **ce qui part réellement à l'analyse**.
 *
 * Elle est affichée en tête de la section, avant les propositions et avant le
 * formulaire, parce que c'est elle la vérité. Les deux autres blocs ne sont que
 * des façons de l'alimenter — il n'existe pas deux lots parallèles.
 *
 * <h2>Une fois dans le lot, un tome est un tome</h2>
 * Un élément venu de la détection et un élément saisi à la main sont
 * strictement la même chose ici : même ligne, même bouton de retrait. La
 * provenance a servi à décider, elle n'a plus à structurer la liste finale.
 */

export interface LotItem {
  seriesTitle: string
  editionName: string
  volumesText: string
  includedVolumes: number[]
}

export function LotContentList({
  items,
  ligneEnCours,
  onRemove,
}: {
  items: LotItem[]
  /**
   * La ligne du formulaire, complète mais pas encore « ajoutée ».
   *
   * Elle compte dans l'analyse (le « + » n'est plus obligatoire), donc elle
   * doit se voir ici — sinon le décompte mentirait. Marquée « en cours de
   * saisie » pour lever l'ambiguïté avec les éléments déjà posés.
   */
  ligneEnCours: LotItem | null
  onRemove: (index: number) => void
}) {
  if (items.length === 0 && !ligneEnCours) {
    return (
      <p className="rounded-lg bg-surface2 px-3 py-2 text-xs text-textDim">
        Rien pour l'instant. Les éléments détectés que tu confirmes arrivent ici, et tu peux en ajouter
        à la main juste en dessous.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <li
          key={`${item.seriesTitle}-${item.editionName}-${index}`}
          className="flex items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary"
        >
          <span>
            {item.seriesTitle} · {item.editionName} · {item.includedVolumes.length} tome
            {item.includedVolumes.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Retirer ${item.seriesTitle} du lot`}
            className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3 text-textDim hover:text-dangerText"
          >
            <X size={14} />
          </button>
        </li>
      ))}

      {ligneEnCours && (
        <li className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-fieldBorder bg-surface2/50 px-3 py-2 text-sm text-textPrimary">
          <span>
            {ligneEnCours.seriesTitle} · {ligneEnCours.editionName} ·{' '}
            {ligneEnCours.includedVolumes.length} tome
            {ligneEnCours.includedVolumes.length > 1 ? 's' : ''}
          </span>
          {/* Le pointillé ne suffit pas : la couleur et la forme seules
              n'expliquent rien à qui ne les distingue pas. */}
          <span className="shrink-0 text-xs text-textDim">en cours de saisie</span>
        </li>
      )}
    </ul>
  )
}
