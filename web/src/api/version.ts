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

/**
 * Le numéro de la livraison, figé à la compilation du bundle (voir
 * web/Dockerfile). `dev` en développement.
 */
export const VERSION_INTERFACE: string = import.meta.env.VITE_VERSION ?? 'dev'

export interface Version {
  /** Le numéro de la livraison servie par l'API, ou `dev` hors conteneur. */
  version: string
}

export function lireVersionServeur(): Promise<Version> {
  return get<Version>('/version')
}

/**
 * Ce qui se lit d'un coup d'œil.
 *
 * Un numéro de version est déjà court, et il se compare — 379 vient après
 * 378 — donc il sort tel quel. Restent deux formes qui ne se comparent pas et
 * auxquelles on n'invente pas d'ordre : `dev`, hors conteneur, et le SHA de
 * 40 caractères des images construites AVANT que les livraisons soient
 * numérotées. Celui-là est tronqué à 7, la forme courte qu'emploient git et
 * GitHub — c'est le seul cas où l'app affiche encore un SHA, et il disparaît
 * dès que les deux images ont été retirées une fois.
 */
export function versionCourte(version: string): string {
  return /^[0-9a-f]{40}$/.test(version) ? version.slice(0, 7) : version
}
