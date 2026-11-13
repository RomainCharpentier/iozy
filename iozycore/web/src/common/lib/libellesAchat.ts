import type { ToBuyElementDto, ToBuyLineDto } from '@/common/types/api'
import { formaterEuros } from '@/common/lib/formats'
import { libelleJour, parseReleaseDate } from '@/common/lib/releaseDate'

/**
 * The words of what there is to buy (lot 216), kept apart from the JSX so
 * that each one can be checked as the text a person reads. The "À acheter"
 * page and the wall of the home page both say them.
 */

const TOME = /^Tome (\d+)$/

/** "Tome 12", "Tomes 11 et 12", "Tomes 3 à 6", "Tomes 2, 5 et 9", "Marins et Villes". */
export function libelleElements(elements: ToBuyElementDto[]): string {
  if (elements.length === 1) return elements[0].label
  const numeros = elements.map((e) => (TOME.test(e.label) && e.number != null ? e.number : null))
  if (numeros.every((n) => n != null)) {
    const n = numeros as number[]
    const suivis = n.every((v, i) => i === 0 || v === n[i - 1] + 1)
    if (suivis && n.length > 2) return `Tomes ${n[0]} à ${n[n.length - 1]}`
    if (n.length <= 4) return `Tomes ${enumerer(n.map(String))}`
    return `Tomes ${n.slice(0, 3).join(', ')}… (${n.length} au total)`
  }
  if (elements.length <= 3) return enumerer(elements.map((e) => e.label))
  return `${elements
    .slice(0, 2)
    .map((e) => e.label)
    .join(', ')} et ${elements.length - 2} autres`
}

function enumerer(mots: string[]): string {
  if (mots.length <= 1) return mots.join('')
  return `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}`
}

/** True when the line is about the work as a whole: its title says everything. */
function oeuvreEntiere(ligne: ToBuyLineDto): boolean {
  return ligne.elements.length === 1 && ligne.elements[0].key === 'work'
}

/**
 * "Vinland Saga, tome 15" - the title of the line. Only the "Tome"/"Tomes"
 * this page writes itself goes lower case after the comma; a label that
 * comes from the catalog ("Switch", "Marins") is kept as it is written.
 */
export function titreLigne(ligne: ToBuyLineDto): string {
  if (oeuvreEntiere(ligne)) return ligne.title
  const quoi = libelleElements(ligne.elements)
  const queDesTomes = ligne.elements.every((e) => TOME.test(e.label) && e.number != null)
  return `${ligne.title}, ${queDesTomes ? quoi.replace(/^Tome/, 'tome') : quoi}`
}

/** "vendredi 13 novembre", "en novembre 2026". */
export function libelleSortie(date: string): string {
  const parts = parseReleaseDate(date)
  if (!parts) return date
  if (parts.precision === 'DAY') return libelleJour(date)
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(parts.year, parts.month - 1, 1)),
  )
  return `en ${mois}`
}

/** Why the line is there, in a few words: when it comes out, what it completes, a wish. */
export function sousTitreLigne(ligne: ToBuyLineDto): string {
  if (ligne.kind === 'UPCOMING' && ligne.releaseDate) {
    const voulu = ligne.elements[0]?.state === 'WANTED'
    return `${libelleSortie(ligne.releaseDate)} · ${voulu ? 'dans tes envies' : 'à suivre dans ta collection'}`
  }
  if (ligne.kind === 'WISH') return 'dans tes envies'
  const n = ligne.elements.length
  return n === 1 ? 'le dernier qui te manque' : `il t’en manque ${n}`
}

/** The accessible name of "Je l'ai": what the click adds, said in full. */
export function nomJeLAi(ligne: ToBuyLineDto): string {
  const premier = ligne.elements[0]
  return oeuvreEntiere(ligne) ? `${ligne.title} : je l'ai` : `${ligne.title}, ${premier.label} : je l'ai`
}

/** "Dépensé en novembre" - the month of the big number. */
export function libelleMoisDepense(mois: string): string {
  const [annee, m] = mois.split('-').map(Number)
  if (!annee || !m) return 'Dépensé ce mois-ci'
  const nom = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(annee, m - 1, 1)))
  return `Dépensé en ${nom}`
}

/** "3 achats · 1 sans prix" - what the big number counts, and what it cannot. */
export function detailDepense(pricedCount: number, unpricedCount: number): string {
  const total = pricedCount + unpricedCount
  if (total === 0) return 'Aucun achat noté ce mois-ci'
  const achats = `${total} achat${total > 1 ? 's' : ''}`
  return unpricedCount === 0 ? achats : `${achats} · ${unpricedCount} sans prix, non compté${unpricedCount > 1 ? 's' : ''}`
}

/** "42,30 € sur 150,00 €" and what is left, or by how much it is over. */
export function etatBudget(depense: number, budget: number): { ligne: string; reste: string; part: number } {
  const part = budget > 0 ? Math.min(1, depense / budget) : 0
  const ecart = budget - depense
  return {
    ligne: `${formaterEuros(depense)} sur ${formaterEuros(budget)}`,
    reste: ecart >= 0 ? `Il te reste ${formaterEuros(ecart)}` : `Dépassé de ${formaterEuros(-ecart)}`,
    part,
  }
}

/** The amount typed, in cents as the server keeps it; null when it is no budget (0, rounds to 0, too high). */
export function montantSaisi(saisie: string): number | null {
  if (saisie.trim() === '') return null
  const montant = Number(saisie.replace(',', '.').replace(/\s/g, ''))
  if (!Number.isFinite(montant)) return null
  const centimes = Math.round(montant * 100) / 100
  return centimes > 0 && centimes <= 100000 ? centimes : null
}
