import type { BoxDto } from '@/common/types/listingRecognition'

/**
 * The photo, with a frame where the engine saw a book.
 *
 * In the one-by-one validation, a single frame at a time: the one of the book in
 * progress, to place the close-up on the shelf. The frame carries the state of the
 * volume (checked, unchecked, already owned, number not read) and its number; on a
 * narrow spine, the number reads from top to bottom, like the printed title.
 */
export type EtatCadre = 'coche' | 'decoche' | 'possede' | 'sansNumero'

export interface Cadre {
  cle: string
  /** "T62", or "?" when the number was not read. */
  libelle: string
  titre: string
  etat: EtatCadre
  box: BoxDto
  /** What the reader saw there ("Chiffre 62 sur la tranche"). */
  indice?: string
}

const BORDURE: Record<EtatCadre, string> = {
  coche: 'border-accent bg-accent/25',
  decoche: 'border-dashed border-textDim/70',
  possede: 'border-ok bg-okTint/60',
  sansNumero: 'border-dashed border-warning bg-warningTint/40',
}

const PASTILLE: Record<EtatCadre, string> = {
  coche: 'bg-accent text-accentInk',
  decoche: 'bg-surface text-textDim',
  possede: 'bg-okTint text-ok',
  sansNumero: 'bg-warning text-warningInk',
}

/**
 * A spine is a rectangle much taller than wide: its label is then
 * read from top to bottom, like the title printed on it - horizontally,
 * "T62" would not fit. The ratio is computed in pixels of the photo;
 * as long as it is not loaded, a landscape phone photo is used
 * as an estimate.
 */
function etiquetteVerticale(box: BoxDto, taille?: { w: number; h: number }): boolean {
  const w = taille?.w ?? 16
  const h = taille?.h ?? 9
  const hauteur = (box.bottom - box.top) * h
  const largeur = (box.right - box.left) * w
  return largeur > 0 && hauteur / largeur > 2.2
}

export function PhotoAnnotee({
  src,
  numero,
  cadres,
  enCours,
  taille,
  interactif = true,
  onBasculer,
  onTaille,
}: {
  /** The local URL of the photo - empty when the browser cannot build one. */
  src: string
  /** The number of the photo as the user counts it: 1, 2, 3. */
  numero: number
  cadres: Cadre[]
  /** The frame currently in one-by-one validation, highlighted. */
  enCours?: string
  /** The dimensions of the photo, once loaded - to orient the labels. */
  taille?: { w: number; h: number }
  /** False: the frames can be looked at without being clicked - the one-by-one validation only shows the current frame. */
  interactif?: boolean
  onBasculer?: (cadre: Cadre) => void
  onTaille?: (taille: { w: number; h: number }) => void
}) {
  return (
    <figure className="relative overflow-hidden rounded-xl bg-surface2">
      {src ? (
        <img
          src={src}
          alt={`Photo ${numero}`}
          className="block w-full"
          onLoad={(e) => onTaille?.({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      ) : (
        <div className="aspect-video w-full" aria-hidden="true" />
      )}
      {cadres.map((cadre) => {
        const possede = cadre.etat === 'possede'
        const nom = `${cadre.libelle} de ${cadre.titre} sur la photo ${numero}${possede ? ', déjà possédé' : ''}`
        const position = {
          left: `${cadre.box.left * 100}%`,
          top: `${cadre.box.top * 100}%`,
          width: `${(cadre.box.right - cadre.box.left) * 100}%`,
          height: `${(cadre.box.bottom - cadre.box.top) * 100}%`,
        }
        const classes = `absolute rounded border-2 ${BORDURE[cadre.etat]} ${
          enCours === cadre.cle ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface2' : ''
        }`
        const etiquette = (
          <span
            className={`absolute left-0 top-0 whitespace-nowrap font-semibold ${PASTILLE[cadre.etat]} ${
              etiquetteVerticale(cadre.box, taille)
                ? 'rounded-b [writing-mode:vertical-rl] px-px py-1 text-[9px] leading-none'
                : 'rounded-br px-1 text-[10px] leading-4'
            }`}
          >
            {cadre.libelle}
          </span>
        )
        if (!interactif) {
          return (
            <div key={cadre.cle} role="img" aria-label={nom} title={cadre.indice} style={position} className={classes}>
              {etiquette}
            </div>
          )
        }
        return (
          <button
            key={cadre.cle}
            type="button"
            role="checkbox"
            aria-checked={cadre.etat === 'coche' || possede}
            disabled={possede}
            aria-label={nom}
            title={cadre.indice}
            onClick={() => onBasculer?.(cadre)}
            style={position}
            className={classes}
          >
            {etiquette}
          </button>
        )
      })}
      <figcaption className="sr-only">
        Photo {numero} : {cadres.length} {cadres.length > 1 ? 'cadres' : 'cadre'}
      </figcaption>
    </figure>
  )
}
