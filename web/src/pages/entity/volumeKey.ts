import type { VolumeCandidateDto } from '@/common/types/api'

/**
 * Clé stable identifiant un tome dans un ensemble de sélection.
 *
 * Une même série peut avoir plusieurs éditions portant chacune un tome
 * numéro 1 : la clé combine donc édition ET numéro, jamais le numéro seul.
 *
 * <p>Vit ici plutôt que dans `VolumeSelectionGrid` parce que c'est une
 * fonction pure, sans lien avec le rendu - et qu'un fichier qui exporte à la
 * fois un composant et autre chose fait perdre le rafraîchissement à chaud à
 * tout le module.
 */
export function volumeKey(v: Pick<VolumeCandidateDto, 'edition' | 'volumeNumber'>): string {
  return `${v.edition}|${v.volumeNumber}`
}
