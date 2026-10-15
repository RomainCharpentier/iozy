/**
 * Positionnement d'un élément <audio>/<video> au point de départ de l'extrait
 */

/**
 * Place l'élément au point de départ s'il en est loin (> 1 s).
 * Sans effet si les métadonnées ne sont pas chargées, ou si le départ dépasse la durée
 * (le média démarre alors au début).
 */
export function seekToStart(media: HTMLMediaElement, start: number): void {
  if (start <= 0 || media.readyState < 1 /* HAVE_METADATA */) return
  if (Number.isFinite(media.duration) && start >= media.duration) return
  if (Math.abs(media.currentTime - start) > 1) {
    media.currentTime = start
  }
}
