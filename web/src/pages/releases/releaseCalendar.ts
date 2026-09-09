import type { ReleaseEntryDto } from '@/common/types/api'
import { parseReleaseDate, yearMonthLocal } from '@/common/lib/releaseDate'

/**
 * Les règles du calendrier des sorties qui se cassent en silence : quel mois
 * on regarde, ses bornes, et comment ses sorties se rangent (lot 146).
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
