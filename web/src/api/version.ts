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
 * web/Dockerfile). Hors conteneur, vite.config.ts le dérive des commits et le
 * suffixe de `-dev` (« 1.1.0-dev ») : on sait de quel commit on part, et qu'on
 * ne regarde pas une livraison.
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
 * Un Majeure.Mineure.Patch est déjà court, et il se compare — 1.3.1 vient
 * après 1.2.0 — donc il sort tel quel. Restent les formes qui ne se comparent
 * pas et auxquelles on n'invente pas d'ordre : `dev` hors conteneur, et le SHA
 * de 40 caractères des images construites AVANT tout numérotage. Celui-là est
 * tronqué à 7, la forme courte qu'emploient git et GitHub — c'est le seul cas
 * où l'app affiche encore un SHA, et il disparaît dès que les deux images ont
 * été retirées une fois.
 */
export function versionCourte(version: string): string {
  return /^[0-9a-f]{40}$/.test(version) ? version.slice(0, 7) : version
}

/**
 * Une construction locale n'est pas une livraison, et ne se compare donc à
 * rien.
 *
 * `dev` et `1.1.0-dev` sortent d'un poste de travail : le premier d'une image
 * construite à la main, le second du serveur de développement. Les confronter
 * à ce que rend l'API - « interface 1.1.0-dev, serveur dev, rechargez » -
 * signalerait un écart à chaque écran alors qu'il n'y a rien à réparer : ce
 * sont deux brouillons, et ils n'ont aucune raison de coïncider.
 */
export function estUneLivraison(version: string): boolean {
  return !version.endsWith('dev')
}
