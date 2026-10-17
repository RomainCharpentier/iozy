/**
 * Positionnement d'un élément <audio>/<video> au point de départ de l'extrait
 */
import { pickPlayableStart } from '@/utils/timecode'

/**
 * Place l'élément au point de départ de la partie s'il en est loin (> 1 s) : départ
 * aléatoire si `fraction` est fournie, toujours assez tôt pour durer `playSeconds`
 * (chrono). Sans effet si les métadonnées ne sont pas chargées.
 */
export function seekToStart(
  media: HTMLMediaElement,
  start: number,
  playSeconds?: number,
  fraction?: number,
  knownDuration?: number
): void {
  if (media.readyState < 1 /* HAVE_METADATA */) return
  // Durée relevée par l'éditeur en priorité : tous les joueurs calculent le même départ
  const target = pickPlayableStart(start, knownDuration || media.duration, playSeconds, fraction)
  if (Math.abs(media.currentTime - target) > 1) {
    media.currentTime = target
  }
}
