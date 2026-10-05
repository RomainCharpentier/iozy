import type { BoxDto } from '@/common/types/listingRecognition'

/**
 * How to show a frame in close-up with a simple background image.
 *
 * The photo is enlarged so that the frame, plus a margin, fills the block,
 * then shifted so that this frame is what one sees. The percentages of
 * `background-position` read "the point at X % of the image is placed at X %
 * of the block": to bring the left edge of the frame (x0) to the edge of the block when
 * the image is enlarged to 1/width, we need X = x0 / (1 - width).
 */
export interface Recadrage {
  /** Fractions of the photo really shown - for the height/width ratio of the block. */
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

/** The width/height ratio of the block that shows this crop, knowing the one of the photo. */
export function rapportDuBloc(recadrage: Recadrage, photo: { w: number; h: number } | undefined): string {
  const w = photo?.w ?? 4
  const h = photo?.h ?? 3
  return `${(recadrage.largeur * w).toFixed(1)} / ${(recadrage.hauteur * h).toFixed(1)}`
}
