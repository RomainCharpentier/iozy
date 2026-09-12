/**
 * Une date de sortie, telle que le serveur la connaît : au jour près
 * (« 2026-10-14 ») ou au mois près (« 2026-10 »). Jamais une année seule -
 * c'est la règle du calendrier des sorties (lot 146), et ce module est le seul
 * endroit du client qui la lit et l'écrit.
 */

/** L'attribut d'une œuvre qui porte sa date de sortie saisie à la main (voir ReleaseCalendarService côté serveur). */
export const RELEASE_DATE_ATTRIBUTE_KEY = 'releaseDate'

export type ReleasePrecision = 'DAY' | 'MONTH'

export interface ReleaseDateParts {
  iso: string
  precision: ReleasePrecision
  year: number
  month: number
  /** Absent au mois près. */
  day: number | null
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/
const MOIS = /^(\d{4})-(\d{2})$/

/** « 2026-10-14 » → jour, « 2026-10 » → mois, tout le reste → null. */
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

/** Une date en UTC, pour que le fuseau de l'appareil ne fasse jamais glisser un jour. */
function dateUtc(parts: ReleaseDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day ?? 1))
}

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options })
}

/** Intl écrit les mois et les jours en minuscules : un titre veut une majuscule. */
function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** « 14 octobre 2026 », « octobre 2026 » - ou null quand la valeur n'est pas une date. */
export function formatReleaseDate(value: unknown): string | null {
  const parts = parseReleaseDate(value)
  if (!parts) return null
  return parts.precision === 'DAY'
    ? formatter({ day: 'numeric', month: 'long', year: 'numeric' }).format(dateUtc(parts))
    : formatter({ month: 'long', year: 'numeric' }).format(dateUtc(parts))
}

/** « 14 oct. », « oct. 2026 » - ce qu'une ligne d'aperçu a la place d'écrire. */
export function libelleDateCourte(value: unknown): string | null {
  const parts = parseReleaseDate(value)
  if (!parts) return null
  return parts.precision === 'DAY'
    ? formatter({ day: 'numeric', month: 'short' }).format(dateUtc(parts))
    : formatter({ month: 'short', year: 'numeric' }).format(dateUtc(parts))
}

/** « mardi 14 octobre » - un jour nommé dans une phrase, ou le nom accessible d'une case. */
export function libelleJour(isoDay: string): string {
  const parts = parseReleaseDate(isoDay)
  if (!parts || parts.precision !== 'DAY') return isoDay
  return formatter({ weekday: 'long', day: 'numeric', month: 'long' }).format(dateUtc(parts))
}

/** « Mardi 14 octobre » - le même jour, en intertitre de ses sorties. */
export function titreDuJour(isoDay: string): string {
  return capitaliser(libelleJour(isoDay))
}

/** « Octobre 2026 » - le titre d'un mois. */
export function libelleMois(yearMonth: string): string {
  const parts = parseReleaseDate(yearMonth)
  if (!parts) return yearMonth
  return capitaliser(formatter({ month: 'long', year: 'numeric' }).format(dateUtc(parts)))
}

/**
 * « lun. » … « dim. », lundi en tête : les colonnes de la grille du mois. Le
 * 1er janvier 2024 est un lundi - n'importe quelle semaine ferait l'affaire,
 * celle-là se vérifie d'un coup d'œil.
 */
export const JOURS_DE_LA_SEMAINE_COURTS: readonly string[] = Array.from({ length: 7 }, (_, i) =>
  formatter({ weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + i))),
)

/** « 2026-09-09 » pour la date locale de l'appareil - jamais `toISOString`, qui parle en UTC et change de jour le soir. */
export function isoLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** « 2026-09 » pour la date locale de l'appareil. */
export function yearMonthLocal(date: Date): string {
  return isoLocal(date).slice(0, 7)
}

/** D'aujourd'hui à dans trois mois, jour pour jour, en dates locales - la fenêtre de l'aperçu de Découvrir. */
export function periodeAVenir(aujourdHui: Date, mois = 3): { from: string; to: string } {
  const fin = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth() + mois, aujourdHui.getDate())
  return { from: isoLocal(aujourdHui), to: isoLocal(fin) }
}

/**
 * Ce qu'une sortie représente pour la collection, dit comme une action ou un
 * état - « à acheter » est ce qu'on fait d'un tome qui manque, pas un constat
 * de manque. Une relation inconnue s'affiche telle quelle plutôt que de
 * disparaître.
 */
export const LIBELLES_RELATION: Record<string, string> = {
  OWNED: 'Possédé',
  MISSING: 'À acheter',
  WANTED: 'Envie',
}

/**
 * D'aujourd'hui à la veille du même jour l'an prochain, en dates locales - la
 * fenêtre de la liste de tout ce qui vient. Un jour de moins qu'une année
 * pleine : le serveur refuse 366 jours et plus, et une année bissextile en
 * compte 366.
 */
export function periodeSurUnAn(aujourdHui: Date): { from: string; to: string } {
  const veille = new Date(aujourdHui.getFullYear() + 1, aujourdHui.getMonth(), aujourdHui.getDate() - 1)
  return { from: isoLocal(aujourdHui), to: isoLocal(veille) }
}
