import { isoLocal, libelleIlYA, libelleJour } from '@/common/lib/releaseDate'
import type { HomeFigureDto, HomeItemDto, HomeLeadDto, HomeReleaseDto, HomeWorkDto } from '@/common/types/home'

/**
 * The sentences of the home page, written from the structured fields the
 * server sends (lot 212). The server says why a work is there; the client says
 * it in French. Nothing here knows a universe: "Tome 15", "Marins" or the work
 * itself come from the label of the element.
 */

const NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre']

/** "deux", or the digits beyond four. */
export function enLettres(n: number): string {
  return NOMBRES[n] ?? String(n)
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

function joursEntre(deIso: string, aIso: string): number {
  const [y1, m1, d1] = deIso.split('-').map(Number)
  const [y2, m2, d2] = aIso.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** "aujourd'hui", "demain", "hier", or the weekday ("vendredi") - a day of this week. */
export function quandCetteSemaine(isoDay: string, now: Date): string {
  const ecart = joursEntre(isoLocal(now), isoDay)
  if (ecart === 0) return "aujourd'hui"
  if (ecart === 1) return 'demain'
  if (ecart === -1) return 'hier'
  return libelleJour(isoDay).split(' ')[0]
}

/** The day of an instant, said like {@link quandCetteSemaine}. */
function jourDeLInstant(isoInstant: string, now: Date): string {
  return quandCetteSemaine(isoLocal(new Date(isoInstant)), now)
}

/** "Vinland Saga, Tome 15 : sortie vendredi." - or the work itself: "Totoro : sortie demain." */
export function titreDeSortie(work: HomeWorkDto, release: HomeReleaseDto, now: Date): string {
  const quoi = release.label ? `${work.title}, ${release.label}` : work.title
  return `${quoi} : sortie ${quandCetteSemaine(release.date, now)}.`
}

/** "Tu en as 8 sur 15." / "Tu en as 3." - a total is never guessed. */
export function ouTuEnEs(work: HomeWorkDto): string | null {
  if (work.ownedCount === 0) return work.wishedCount > 0 ? 'Dans tes envies.' : null
  if (work.totalCount === 1 && work.ownedCount === 1) return 'Dans ta collection.'
  if (work.totalCount !== null) return `Tu en as ${work.ownedCount} sur ${work.totalCount}.`
  return `Tu en as ${work.ownedCount}.`
}

/** "Le 13 novembre" / "En décembre 2026" - a next release, beyond this week. */
function prochaine(release: HomeReleaseDto): string {
  const quoi = release.label ? `${release.label}, ` : ''
  if (release.precision === 'DAY') return `Prochaine sortie : ${quoi}${libelleJour(release.date)}.`
  const [annee, mois] = release.date.split('-').map(Number)
  const nomDuMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(annee, mois - 1, 1)))
  return `Prochaine sortie : ${quoi}${nomDuMois} ${annee}.`
}

/** The paragraph under the lead: where the collector stands, what is missing, what comes next. */
export function pourquoiLaUne(une: HomeLeadDto, now: Date): string {
  const phrases: string[] = []
  if (une.reason === 'MOVED' && une.work.lastMovedAt) {
    phrases.push(`Ta dernière nouveauté, ${libelleIlYA(une.work.lastMovedAt, now)}.`)
  }
  const ou = ouTuEnEs(une.work)
  if (ou) phrases.push(ou)
  if (une.work.missingCount > 0) {
    phrases.push(`Il t'en manque ${une.work.missingCount}.`)
  }
  const memeSortie = une.release && une.nextRelease
    && une.release.date === une.nextRelease.date && une.release.label === une.nextRelease.label
  if (une.nextRelease && !memeSortie) phrases.push(prochaine(une.nextRelease))
  return phrases.join(' ')
}

/** The kicker of the lead: "À la une · vendredi 13 novembre", or "À la une". */
export function surtitreDeLaUne(une: HomeLeadDto): string {
  return une.release && une.release.precision === 'DAY' ? `À la une · ${libelleJour(une.release.date)}` : 'À la une'
}

/** One line of "aussi cette semaine": a headline and its detail. */
export function ligneAussi(item: HomeItemDto, now: Date): { titre: string; detail: string } {
  if (item.reason === 'RELEASE' && item.release) {
    return { titre: titreDeSortie(item.work, item.release, now), detail: ouTuEnEs(item.work) ?? '' }
  }
  const jour = item.work.lastMovedAt ? jourDeLInstant(item.work.lastMovedAt, now) : 'cette semaine'
  // A copy and a wish both move a work; only a work with no copy is surely a wish.
  const detail = item.work.ownedCount === 0 ? `Ajouté à tes envies ${jour}.` : `Mis à jour ${jour}. ${ouTuEnEs(item.work) ?? ''}`
  return { titre: item.work.title, detail: detail.trim() }
}

/** "objets dans ta collection." and its lines below: this month, this week. */
export function legendeDuChiffre(chiffre: HomeFigureDto, now: Date): { libelle: string; details: string[] } {
  const details: string[] = []
  if (chiffre.addedThisMonth > 0) {
    const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(now)
    details.push(`+${chiffre.addedThisMonth} depuis le 1er ${mois}.`)
  }
  if (chiffre.releasesThisWeek > 0) {
    details.push(`${pluriel(chiffre.releasesThisWeek, 'sortie')} cette semaine.`)
  }
  return { libelle: `${chiffre.totalObjects > 1 ? 'objets' : 'objet'} dans ta collection.`, details }
}

/** "Frieren : il n'en manque plus qu'un." / "Catan : plus que deux à trouver." */
export function titrePresqueFini(work: HomeWorkDto): string {
  return work.missingCount === 1
    ? `${work.title} : il n'en manque plus qu'un.`
    : `${work.title} : plus que ${enLettres(work.missingCount)} à trouver.`
}

/** "4 œuvres · 12 objets" - what one shelf holds. */
export function contenuDuRayon(workCount: number, objectCount: number): string {
  return `${pluriel(workCount, 'œuvre')} · ${pluriel(objectCount, 'objet')}`
}
