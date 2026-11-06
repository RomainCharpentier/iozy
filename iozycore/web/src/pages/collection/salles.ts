import { editionDe, numeroDe } from '@/common/lib/attributsTome'
import { coverImageUrlFrom } from '@/common/lib/coverImage'
import type { AffichageCollection } from '@/common/lib/preferencesCollection'
import type { EditionProgressDto, EntityResponse } from '@/common/types/api'

/**
 * How My collection lays out its works: one room per category, shelves of one
 * height, the state of a series read on its spines.
 *
 * Pure on purpose: the width of an object decides the shelves, so every rule
 * can be tested without a browser.
 */

export interface MesuresSalle {
  /** The height of a cover on its shelf. */
  hauteur: number
  /** The width of a spine; 0 in the compact view, which has none. */
  dos: number
  /** At most this many owned spines per series: enough to read it, never a wall. */
  dosMax: number
  ecart: number
}

/** Under this width, the room uses the sizes of a phone. */
const LARGEUR_TELEPHONE = 720

export function mesuresDeLaSalle(affichage: AffichageCollection, largeur: number): MesuresSalle {
  const telephone = largeur > 0 && largeur <= LARGEUR_TELEPHONE
  if (affichage === 'compact') {
    return telephone ? { hauteur: 84, dos: 0, dosMax: 0, ecart: 8 } : { hauteur: 108, dos: 0, dosMax: 0, ecart: 10 }
  }
  return telephone ? { hauteur: 128, dos: 9, dosMax: 8, ecart: 14 } : { hauteur: 190, dos: 13, dosMax: 12, ecart: 24 }
}

/** The ratio of a cover format, from the Tailwind class that carries it (see UNIVERSE_ASPECTS). */
export function ratioDeLAspect(aspectClassName: string): number {
  if (aspectClassName === 'aspect-square') return 1
  const trouve = /aspect-\[(\d+)\/(\d+)\]/.exec(aspectClassName)
  return trouve ? Number(trouve[1]) / Number(trouve[2]) : 2 / 3
}

/** The volumes the edition lacks. An unknown total only counts the holes between owned volumes. */
export function tomesManquants(edition: EditionProgressDto | null | undefined): number[] {
  if (!edition) return []
  const possedes = new Set(edition.ownedVolumeNumbers)
  const borne = edition.totalVolumes ?? Math.max(0, ...edition.ownedVolumeNumbers)
  const manquants: number[] = []
  for (let numero = 1; numero <= borne; numero++) {
    if (!possedes.has(numero)) manquants.push(numero)
  }
  return manquants
}

export interface DosSalle {
  numero: number
  etat: 'possede' | 'voulu' | 'manquant'
  jaquetteUrl: string | null
}

/** What stands next to a cover: the owned volumes, then at most three empty slots, wanted ones first. */
export function dosDeLOeuvre(
  entity: EntityResponse,
  edition: EditionProgressDto | null,
  tomesVoulus: ReadonlySet<string>,
  dosMax: number,
): DosSalle[] {
  if (dosMax === 0 || !edition) return []
  const jaquettes = new Map<number, string | null>()
  const voulus = new Set<number>()
  for (const variant of entity.variants) {
    const numero = numeroDe(variant)
    if (numero === null) continue
    // Another edition has its own covers and its own wishes. A volume without a
    // named edition joins this one, as the server counts it.
    const nomEdition = editionDe(variant)
    if (nomEdition !== '' && !edition.sourceEditions.includes(nomEdition)) continue
    if (!jaquettes.get(numero)) jaquettes.set(numero, coverImageUrlFrom(variant.attributes))
    if (tomesVoulus.has(variant.id)) voulus.add(numero)
  }
  const possedes = new Set(edition.ownedVolumeNumbers)
  const presents = [...possedes]
    .sort((a, b) => a - b)
    .slice(0, dosMax)
    .map((numero): DosSalle => ({ numero, etat: 'possede', jaquetteUrl: jaquettes.get(numero) ?? null }))
  const trous = tomesManquants(edition)
  const vides = [...new Set([...trous, ...voulus])].filter((numero) => !possedes.has(numero))
  const choisis = [...vides.filter((numero) => voulus.has(numero)), ...vides.filter((numero) => !voulus.has(numero))]
    .slice(0, 3)
    .sort((a, b) => a - b)
    .map((numero): DosSalle => ({ numero, etat: voulus.has(numero) ? 'voulu' : 'manquant', jaquetteUrl: null }))
  return [...presents, ...choisis]
}

export interface SegmentPiste {
  /** Percent of the bar. */
  debut: number
  largeur: number
}

/**
 * The compact view has no spines: one thin bar says the same thing. A filled
 * run is owned volumes, a hole is missing ones. Null when it would say nothing,
 * that is when nothing is known to be missing.
 */
export function pisteDeLOeuvre(edition: EditionProgressDto | null): SegmentPiste[] | null {
  if (!edition || edition.ownedVolumeNumbers.length === 0) return null
  if (edition.totalVolumes === null && tomesManquants(edition).length === 0) return null
  const possedes = [...new Set(edition.ownedVolumeNumbers)].sort((a, b) => a - b)
  const borne = Math.max(edition.totalVolumes ?? 0, possedes[possedes.length - 1])
  const segments: SegmentPiste[] = []
  for (let i = 0; i < possedes.length; i++) {
    let fin = i
    while (possedes[fin + 1] === possedes[fin] + 1) fin++
    segments.push({
      debut: ((possedes[i] - 1) * 100) / borne,
      largeur: ((fin - i + 1) * 100) / borne,
    })
    i = fin
  }
  return segments
}

/** The room an object takes on its shelf. A title needs a minimum to stay readable. */
export function largeurObjet(ratio: number, nombreDeDos: number, mesures: MesuresSalle): number {
  const face = Math.round(mesures.hauteur * ratio)
  return nombreDeDos > 0 ? Math.max(face + 3 + nombreDeDos * (mesures.dos + 2), 100) : Math.max(face, 70)
}

export interface Rangee<T> {
  objets: T[]
  /** A shelf that is nearly full spreads over the width; a short last one stays on the left. */
  etalee: boolean
}

/** Cuts the objects into shelves. Unmeasured (first paint, test runner): one wide shelf. */
export function couperEnRangees<T>(
  objets: T[],
  largeurDe: (objet: T) => number,
  largeur: number,
  ecart: number,
): Rangee<T>[] {
  if (largeur <= 0) return objets.length ? [{ objets, etalee: false }] : []
  const lignes: { objets: T[]; occupe: number }[] = []
  let courante: { objets: T[]; occupe: number } | null = null
  for (const objet of objets) {
    const taille = largeurDe(objet)
    if (courante && courante.occupe + ecart + taille > largeur) courante = null
    if (!courante) {
      courante = { objets: [objet], occupe: taille }
      lignes.push(courante)
    } else {
      courante.objets.push(objet)
      courante.occupe += ecart + taille
    }
  }
  return lignes.map((ligne, index) => ({
    objets: ligne.objets,
    etalee: index < lignes.length - 1 || ligne.occupe > largeur * 0.8,
  }))
}

/** A spine cut from the cover of the series is taken at another place for each number. */
export function positionDeLaTranche(numero: number, aSaJaquette: boolean): number {
  return aSaJaquette ? 15 : 22 + (numero * 17) % 56
}

export const CONSOLE_A_PRECISER = 'Console à préciser'
export const EDITEUR_INCONNU = 'Éditeur inconnu'

/** A run of objects under one publisher; `editeur` null: no label, each object stands alone. */
export interface LotSalle<T> {
  editeur: string | null
  objets: T[]
}

/** Everything under one console; `console` null: a room that does not arrange by console. */
export interface SectionSalle<T> {
  console: string | null
  lots: LotSalle<T>[]
}

/** The largest groups first, then by name, what is not known always last. */
function grouper<T>(objets: T[], clesDe: (objet: T) => string[], inconnu: string): [string, T[]][] {
  const groupes = new Map<string, T[]>()
  for (const objet of objets) {
    for (const cle of clesDe(objet)) {
      const groupe = groupes.get(cle)
      if (groupe) groupe.push(objet)
      else groupes.set(cle, [objet])
    }
  }
  return [...groupes.entries()].sort(
    ([a, x], [b, y]) =>
      Number(a === inconnu) - Number(b === inconnu) || y.length - x.length || a.localeCompare(b, 'fr'),
  )
}

/**
 * The order of a room, decided rather than chosen (owner, 2026-11-06): video
 * games by console then publisher, board games by publisher, anything else as it
 * comes (by title). A game owned on two consoles stands under each.
 */
export function rangerLaSalle<T extends { consoles: string[]; editeur: string | null }>(
  code: string,
  objets: T[],
): SectionSalle<T>[] {
  if (objets.length === 0) return []
  const parEditeur = (liste: T[]): LotSalle<T>[] =>
    grouper(liste, (objet) => [objet.editeur ?? EDITEUR_INCONNU], EDITEUR_INCONNU).map(([editeur, lot]) => ({
      editeur,
      objets: lot,
    }))
  if (code === 'VIDEO_GAME') {
    return grouper(
      objets,
      (objet) => (objet.consoles.length > 0 ? objet.consoles : [CONSOLE_A_PRECISER]),
      CONSOLE_A_PRECISER,
    ).map(([console, liste]) => ({ console, lots: parEditeur(liste) }))
  }
  if (code === 'BOARD_GAME') return [{ console: null, lots: parEditeur(objets) }]
  return [{ console: null, lots: [{ editeur: null, objets }] }]
}

/** The room between two objects of one publisher. */
export const ECART_LOT = 12

/** Cuts a publisher too wide for one shelf: it goes on over the next ones. */
export function couperLeLot<T>(objets: T[], largeurDe: (objet: T) => number, largeur: number): T[][] {
  return couperEnRangees(objets, largeurDe, largeur, ECART_LOT).map((rangee) => rangee.objets)
}
