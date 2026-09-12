import type { ReleaseEntryDto } from '@/common/types/api'
import { parseReleaseDate, yearMonthLocal } from '@/common/lib/releaseDate'

/**
 * Les règles du calendrier des sorties qui se cassent en silence : quel mois
 * on regarde, ses bornes, la grille qui le dessine, et comment ses sorties se
 * rangent (lot 146).
 */

const MOIS = /^\d{4}-\d{2}$/

/** Le mois demandé par l'URL (`?mois=2026-10`), ou celui de l'appareil quand l'URL se tait ou déraille. */
export function moisDepuisParametre(parametre: string | null, aujourdHui: Date): string {
  if (parametre && MOIS.test(parametre) && parseReleaseDate(parametre)) return parametre
  return yearMonthLocal(aujourdHui)
}

/** Du premier au dernier jour du mois, inclus - ce que le serveur attend. */
export function bornesDuMois(yearMonth: string): { from: string; to: string } {
  const [annee, mois] = yearMonth.split('-').map(Number)
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate()
  return { from: `${yearMonth}-01`, to: `${yearMonth}-${String(dernierJour).padStart(2, '0')}` }
}

export function moisSuivant(yearMonth: string): string {
  return decaler(yearMonth, 1)
}

export function moisPrecedent(yearMonth: string): string {
  return decaler(yearMonth, -1)
}

function decaler(yearMonth: string, mois: number): string {
  const [annee, m] = yearMonth.split('-').map(Number)
  const date = new Date(Date.UTC(annee, m - 1 + mois, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface CaseDuMois {
  /** « 2026-10-14 » */
  iso: string
  /** Le numéro du jour, ce que la case écrit. */
  jour: number
  /** Un jour d'un mois voisin, là pour compléter la semaine - grisé, jamais cliquable. */
  horsMois: boolean
}

/**
 * Les semaines qui couvrent le mois, lundi en tête : quatre à six lignes de
 * sept cases, les premières et dernières complétées par les mois voisins.
 * Tout en UTC : le fuseau de l'appareil n'a rien à dire sur le jour où tombe
 * le 1er.
 */
export function grilleDuMois(yearMonth: string): CaseDuMois[][] {
  const [annee, mois] = yearMonth.split('-').map(Number)
  // `getUTCDay` compte à partir du dimanche : ramené au lundi.
  const decalage = (new Date(Date.UTC(annee, mois - 1, 1)).getUTCDay() + 6) % 7
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate()
  const semaines: CaseDuMois[][] = []
  for (let debut = 1 - decalage; debut <= nbJours; debut += 7) {
    semaines.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(Date.UTC(annee, mois - 1, debut + i))
        return { iso: date.toISOString().slice(0, 10), jour: date.getUTCDate(), horsMois: date.getUTCMonth() !== mois - 1 }
      }),
    )
  }
  return semaines
}

export interface JourDeSorties {
  /** « 2026-10-14 » */
  iso: string
  entries: ReleaseEntryDto[]
}

export interface MoisRange {
  /** Les sorties datées au mois seulement : la source ne connaît pas le jour. */
  aPreciser: ReleaseEntryDto[]
  /** Les jours qui ont au moins une sortie, dans l'ordre - jamais un jour vide. */
  jours: JourDeSorties[]
}

/** Range les sorties d'un mois par jour, celles sans jour connu à part. L'ordre du serveur est conservé. */
export function rangerParJour(entries: ReleaseEntryDto[]): MoisRange {
  const aPreciser: ReleaseEntryDto[] = []
  const parJour = new Map<string, ReleaseEntryDto[]>()
  for (const entry of entries) {
    if (entry.precision === 'MONTH') {
      aPreciser.push(entry)
      continue
    }
    const jour = parJour.get(entry.date) ?? []
    jour.push(entry)
    parJour.set(entry.date, jour)
  }
  return { aPreciser, jours: [...parJour.entries()].map(([iso, e]) => ({ iso, entries: e })) }
}

/** Le décompte par catégorie, dans l'ordre d'apparition - ce que les puces de filtre affichent. */
export function compterParCategorie(entries: ReleaseEntryDto[]): Map<string, number> {
  const comptes = new Map<string, number>()
  for (const entry of entries) comptes.set(entry.entityTypeId, (comptes.get(entry.entityTypeId) ?? 0) + 1)
  return comptes
}

/** Une œuvre peut sortir plusieurs fois dans le mois (deux tomes) : la clé porte ce qui sort, pas seulement qui. */
export function cleDeSortie(entry: Pick<ReleaseEntryDto, 'entityId' | 'label' | 'date'>): string {
  return `${entry.entityId}|${entry.label}|${entry.date}`
}

export interface MoisDeSorties {
  /** « 2026-10 » */
  mois: string
  entries: ReleaseEntryDto[]
}

/**
 * Les sorties dans l'ordre du calendrier, groupées par mois - la liste de
 * tout ce qui vient. Dans un mois, celles datées au jour d'abord, dans
 * l'ordre des jours ; celles connues au mois près ferment la marche : on ne
 * peut pas les placer, on ne les fait pas passer devant.
 */
export function grouperParMois(entries: ReleaseEntryDto[]): MoisDeSorties[] {
  const triees = [...entries].sort((a, b) => {
    const [ka, kb] = [cleDeTri(a), cleDeTri(b)]
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  const parMois = new Map<string, ReleaseEntryDto[]>()
  for (const entry of triees) {
    const mois = entry.date.slice(0, 7)
    const sorties = parMois.get(mois) ?? []
    sorties.push(entry)
    parMois.set(mois, sorties)
  }
  return [...parMois.entries()].map(([mois, e]) => ({ mois, entries: e }))
}

/** « 2026-10-14 » tel quel ; « 2026-10 » devient « 2026-10-99 », après tous les jours du mois. */
function cleDeTri(entry: ReleaseEntryDto): string {
  return entry.precision === 'MONTH' ? `${entry.date}-99` : entry.date
}
