import type { ReleaseEntryDto } from '@/common/types/api'
import { parseReleaseDate, yearMonthLocal } from '@/common/lib/releaseDate'

/**
 * The rules of the release calendar that break silently: which month
 * is being looked at, its bounds, the grid that draws it, and how its releases are
 * sorted (batch 146).
 */

const MOIS = /^\d{4}-\d{2}$/

/** The month asked by the URL (`?mois=2026-10`), or the one of the device when the URL is silent or derails. */
export function moisDepuisParametre(parametre: string | null, aujourdHui: Date): string {
  if (parametre && MOIS.test(parametre) && parseReleaseDate(parametre)) return parametre
  return yearMonthLocal(aujourdHui)
}

/** From the first to the last day of the month, included - what the server expects. */
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
  /** "2026-10-14" */
  iso: string
  /** The number of the day, what the cell writes. */
  jour: number
  /** A day of a neighbouring month, there to complete the week - greyed out, never clickable. */
  horsMois: boolean
}

/**
 * The weeks that cover the month, Monday first: four to six rows of
 * seven cells, the first and last ones completed by the neighbouring months.
 * All in UTC: the time zone of the device has nothing to say about the day on which
 * the 1st falls.
 */
export function grilleDuMois(yearMonth: string): CaseDuMois[][] {
  const [annee, mois] = yearMonth.split('-').map(Number)
  // `getUTCDay` counts from Sunday: brought back to Monday.
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
  /** "2026-10-14" */
  iso: string
  entries: ReleaseEntryDto[]
}

export interface MoisRange {
  /** The releases dated to the month only: the source does not know the day. */
  aPreciser: ReleaseEntryDto[]
  /** The days that have at least one release, in order - never an empty day. */
  jours: JourDeSorties[]
}

/** Sorts the releases of a month by day, the ones without a known day apart. The server order is kept. */
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

/** The count by category, in order of appearance - what the filter chips display. */
export function compterParCategorie(entries: ReleaseEntryDto[]): Map<string, number> {
  const comptes = new Map<string, number>()
  for (const entry of entries) comptes.set(entry.entityTypeId, (comptes.get(entry.entityTypeId) ?? 0) + 1)
  return comptes
}

/** A work can come out several times in the month (two volumes): the key carries what comes out, not only who. */
export function cleDeSortie(entry: Pick<ReleaseEntryDto, 'entityId' | 'label' | 'date'>): string {
  return `${entry.entityId}|${entry.label}|${entry.date}`
}

export interface MoisDeSorties {
  /** "2026-10" */
  mois: string
  entries: ReleaseEntryDto[]
}

/**
 * The releases in calendar order, grouped by month - the list of
 * everything that is coming. Within a month, those dated to the day first, in
 * the order of the days; those known to the month only close the march: they cannot
 * be placed, so they are not put in front.
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

/** "2026-10-14" as it is; "2026-10" becomes "2026-10-99", after all the days of the month. */
function cleDeTri(entry: ReleaseEntryDto): string {
  return entry.precision === 'MONTH' ? `${entry.date}-99` : entry.date
}
