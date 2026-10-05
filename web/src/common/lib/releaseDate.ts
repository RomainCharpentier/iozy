/**
 * A release date, as the server knows it: to the day ("2026-10-14")
 * or to the month ("2026-10"). Never a year alone - this is the rule of the
 * release calendar (batch 146), and this module is the only place of the
 * client that reads and writes it.
 */

/** The attribute of a work that carries its release date entered by hand (see ReleaseCalendarService on the server side). */
export const RELEASE_DATE_ATTRIBUTE_KEY = 'releaseDate'

export type ReleasePrecision = 'DAY' | 'MONTH'

export interface ReleaseDateParts {
  iso: string
  precision: ReleasePrecision
  year: number
  month: number
  /** Absent when the precision is the month. */
  day: number | null
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/
const MOIS = /^(\d{4})-(\d{2})$/

/** "2026-10-14" → day, "2026-10" → month, everything else → null. */
export function parseReleaseDate(value: unknown): ReleaseDateParts | null {
  if (typeof value !== 'string') return null
  const texte = value.trim()
  const jour = JOUR.exec(texte)
  if (jour) {
    const [year, month, day] = [Number(jour[1]), Number(jour[2]), Number(jour[3])]
    if (!estUnJourValide(year, month, day)) return null
    return { iso: texte, precision: 'DAY', year, month, day }
  }
  const mois = MOIS.exec(texte)
  if (mois) {
    const [year, month] = [Number(mois[1]), Number(mois[2])]
    if (month < 1 || month > 12) return null
    return { iso: texte, precision: 'MONTH', year, month, day: null }
  }
  return null
}

function estUnJourValide(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** A date in UTC, so that the time zone of the device never shifts a day. */
function dateUtc(parts: ReleaseDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day ?? 1))
}

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options })
}

/** Intl writes months and days in lowercase: a title wants a capital letter. */
function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** "14 octobre 2026", "octobre 2026" - or null when the value is not a date. */
export function formatReleaseDate(value: unknown): string | null {
  const parts = parseReleaseDate(value)
  if (!parts) return null
  return parts.precision === 'DAY'
    ? formatter({ day: 'numeric', month: 'long', year: 'numeric' }).format(dateUtc(parts))
    : formatter({ month: 'long', year: 'numeric' }).format(dateUtc(parts))
}

/** "14 oct.", "oct. 2026" - what a preview row has room to write. */
export function libelleDateCourte(value: unknown): string | null {
  const parts = parseReleaseDate(value)
  if (!parts) return null
  return parts.precision === 'DAY'
    ? formatter({ day: 'numeric', month: 'short' }).format(dateUtc(parts))
    : formatter({ month: 'short', year: 'numeric' }).format(dateUtc(parts))
}

/** "mardi 14 octobre" - a day named in a sentence, or the accessible name of a cell. */
export function libelleJour(isoDay: string): string {
  const parts = parseReleaseDate(isoDay)
  if (!parts || parts.precision !== 'DAY') return isoDay
  return formatter({ weekday: 'long', day: 'numeric', month: 'long' }).format(dateUtc(parts))
}

/** "Mardi 14 octobre" - the same day, as a subheading of its releases. */
export function titreDuJour(isoDay: string): string {
  return capitaliser(libelleJour(isoDay))
}

/** "Octobre 2026" - the title of a month. */
export function libelleMois(yearMonth: string): string {
  const parts = parseReleaseDate(yearMonth)
  if (!parts) return yearMonth
  return capitaliser(formatter({ month: 'long', year: 'numeric' }).format(dateUtc(parts)))
}

/**
 * "lun." … "dim.", Monday first: the columns of the month grid. January 1st,
 * 2024 is a Monday - any week would do, this one can be checked at a
 * glance.
 */
export const JOURS_DE_LA_SEMAINE_COURTS: readonly string[] = Array.from({ length: 7 }, (_, i) =>
  formatter({ weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i))),
)

/** "2026-09-09" for the local date of the device - never `toISOString`, which speaks in UTC and changes day in the evening. */
export function isoLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "2026-09" for the local date of the device. */
export function yearMonthLocal(date: Date): string {
  return isoLocal(date).slice(0, 7)
}

/** From today to three months later, day for day, in local dates - the window of the Discover preview. */
export function periodeAVenir(aujourdHui: Date, mois = 3): { from: string; to: string } {
  const fin = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth() + mois, aujourdHui.getDate())
  return { from: isoLocal(aujourdHui), to: isoLocal(fin) }
}

/**
 * What a release represents for the collection, said as an action or a
 * state - "à acheter" is what you do with a missing volume, not a statement
 * of lack. An unknown relation is displayed as it is rather than
 * disappearing.
 */
export const LIBELLES_RELATION: Record<string, string> = {
  OWNED: 'Possédé',
  MISSING: 'À acheter',
  WANTED: 'Envie',
}

/**
 * From today to the day before the same day next year, in local dates - the
 * window of the list of everything that is coming. One day less than a full
 * year: the server refuses 366 days and more, and a leap year has 366.
 */
export function periodeSurUnAn(aujourdHui: Date): { from: string; to: string } {
  const veille = new Date(aujourdHui.getFullYear() + 1, aujourdHui.getMonth(), aujourdHui.getDate() - 1)
  return { from: isoLocal(aujourdHui), to: isoLocal(veille) }
}
