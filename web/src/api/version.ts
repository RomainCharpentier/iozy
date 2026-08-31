import { get } from './client'

/**
 * Quelle livraison tourne — côté serveur, et côté interface.
 *
 * <h2>Deux versions, parce qu'il y a deux images</h2>
 * L'API et l'app web sont construites et publiées séparément, puis récupérées
 * séparément par le NAS. Elles viennent du même commit dans l'immense majorité
 * des cas — mais pas toujours : un service worker qui garde l'ancienne coquille,
 * une image sur deux qui n'a pas été tirée, et l'écran ment sans le savoir.
 * N'afficher que celle du serveur reviendrait à la présenter comme celle de
 * l'app, ce qui est faux exactement quand ça compte.
 */

/** Figée à la compilation du bundle (voir web/Dockerfile). `dev` en développement. */
export const VERSION_INTERFACE: string = import.meta.env.VITE_VERSION ?? 'dev'

export interface Version {
  /** Le SHA complet du commit livré, ou `dev` hors conteneur. */
  version: string
}

export function lireVersionServeur(): Promise<Version> {
  return get<Version>('/version')
}

/**
 * Ce qui se lit d'un coup d'œil : les sept premiers caractères d'un SHA, la
 * forme courte qu'emploient git et GitHub. `dev` est rendu tel quel — le
 * tronquer donnerait « dev » aussi, mais par accident.
 */
export function versionCourte(version: string): string {
  return /^[0-9a-f]{40}$/.test(version) ? version.slice(0, 7) : version
}
