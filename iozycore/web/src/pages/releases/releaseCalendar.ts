import type { ReleaseEntryDto } from '@/common/types/api'
import { libelleMois } from '@/common/lib/releaseDate'

/**
 * The rules of the releases page that break silently: which release comes
 * next, how many days are left, which categories the filters offer, and how
 * the list is grouped (lot 215).
 */

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

/** A work can come out several times in the month (two volumes): the key carries what comes out, not only who. */
export function cleDeSortie(entry: Pick<ReleaseEntryDto, 'entityId' | 'label' | 'date'>): string {
  return `${entry.entityId}|${entry.label}|${entry.date}`
}

/**
 * The categories that have releases, in order of appearance - what the filter
 * chips offer. Read from the data, never from a list of known universes: a
 * custom type with a dated release gets its chip like the others.
 */
export function compterParCategorie(entries: ReleaseEntryDto[]): Map<string, number> {
  const comptes = new Map<string, number>()
  for (const entry of entries) comptes.set(entry.entityTypeId, (comptes.get(entry.entityTypeId) ?? 0) + 1)
  return comptes
}

/**
 * The release the countdown is about: the first one known to the day, from
 * today on. A release known to the month only cannot be counted down - it
 * becomes the next one only when nothing is dated to the day.
 */
export function prochaineSortie(entries: ReleaseEntryDto[], aujourdHui: string): ReleaseEntryDto | null {
  const aVenir = grouperParMois(entries).flatMap((m) => m.entries)
  return (
    aVenir.find((e) => e.precision === 'DAY' && e.date >= aujourdHui) ??
    aVenir.find((e) => e.precision === 'MONTH' && e.date >= aujourdHui.slice(0, 7)) ??
    null
  )
}

/** Whole days from today to a day, in local dates: 0 today, 1 tomorrow. */
export function joursAvant(jour: string, aujourdHui: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  const [a0, m0, j0] = aujourdHui.split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, j) - Date.UTC(a0, m0 - 1, j0)) / 86_400_000)
}

/** What the collection does not have yet: a volume missing from an owned series, or a wished work. */
export function estManquante(entry: Pick<ReleaseEntryDto, 'relation'>): boolean {
  return entry.relation === 'MISSING' || entry.relation === 'WANTED'
}

/** The big number and the word under it: "5 jours", "1 jour", "Aujourd'hui". */
export function compteARebours(entry: ReleaseEntryDto, aujourdHui: string): { nombre: string; mot: string } {
  if (entry.precision === 'MONTH') return { nombre: libelleMois(entry.date), mot: 'date à préciser' }
  const jours = joursAvant(entry.date, aujourdHui)
  if (jours <= 0) return { nombre: "Aujourd'hui", mot: '' }
  if (jours === 1) return { nombre: 'Demain', mot: '' }
  return { nombre: String(jours), mot: 'jours' }
}

/**
 * The two spellings of the same feed. `webcal://` opens the agenda app of the
 * device directly (Apple Calendrier, Outlook); Google Agenda wants the
 * `https://` link pasted in "Ajouter depuis une URL".
 */
export function liensAbonnement(feedPath: string, origine: string): { https: string; webcal: string } {
  const https = `${origine}${feedPath}`
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') }
}
