import type { BoxDto } from '@/common/types/listingRecognition'

/**
 * Comment montrer un cadre en gros plan avec une simple image de fond.
 *
 * La photo est agrandie pour que le cadre, plus une marge, remplisse le bloc,
 * puis décalée pour que ce cadre soit ce qu'on voit. Les pourcentages de
 * `background-position` se lisent « le point à X % de l'image se place à X %
 * du bloc » : pour amener le bord gauche du cadre (x0) au bord du bloc quand
 * l'image est agrandie à 1/largeur, il faut X = x0 / (1 - largeur).
 */
export interface Recadrage {
  /** Fractions de la photo réellement montrées - pour le rapport hauteur/largeur du bloc. */
  largeur: number
  hauteur: number
  backgroundSize: string
  backgroundPosition: string
}

export function recadrer(box: BoxDto, marge = 0.06): Recadrage {
  const x0 = Math.max(0, box.left - marge)
  const y0 = Math.max(0, box.top - marge)
  const x1 = Math.min(1, box.right + marge)
  const y1 = Math.min(1, box.bottom + marge)
  const largeur = Math.max(0.01, x1 - x0)
  const hauteur = Math.max(0.01, y1 - y0)
  const position = (debut: number, taille: number) => (taille >= 1 ? 0 : (debut / (1 - taille)) * 100)
  return {
    largeur,
    hauteur,
    backgroundSize: `${(100 / largeur).toFixed(2)}% ${(100 / hauteur).toFixed(2)}%`,
    backgroundPosition: `${position(x0, largeur).toFixed(2)}% ${position(y0, hauteur).toFixed(2)}%`,
  }
}

/** Le rapport largeur/hauteur du bloc qui montre ce recadrage, connaissant celui de la photo. */
export function rapportDuBloc(recadrage: Recadrage, photo: { w: number; h: number } | undefined): string {
  const w = photo?.w ?? 4
  const h = photo?.h ?? 3
  return `${(recadrage.largeur * w).toFixed(1)} / ${(recadrage.hauteur * h).toFixed(1)}`
}
