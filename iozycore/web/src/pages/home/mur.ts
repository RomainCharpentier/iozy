import type { WorkProgressDto } from '@/common/types/api'

/**
 * The wall of the home page: what the collector has, what is coming, what is
 * wished, and ideas, mixed in an order that changes once a day.
 *
 * A tile carries a sign only when it is an exception: a release to come
 * (greyed, with its days), a wish, a recent arrival, or an idea. What the
 * collector simply has carries nothing.
 */
export type SigneTuile = 'SORTIE' | 'ENVIE' | 'NOUVEAU' | 'IDEE'

export interface Tuile {
  cle: string
  titre: string
  couverture: string | null
  to: string
  /** The type of the work, to filter the wall by category. */
  entityTypeId: string | null
  signe: SigneTuile | null
  /** Days before a release, for the sign "SORTIE". */
  jours?: number
}

export interface Idee {
  title: string
  imageUrl: string | null
  entityTypeId: string | null
}

const JOUR_MS = 24 * 60 * 60 * 1000
const SORTIES_MAX = 4
const NOUVEAU_JOURS = 30
/** Where the ideas sit in the mixed list: spread out, and fixed, so late ideas do not reshuffle the wall. */
const PLACES_DES_IDEES = [3, 9, 15, 21, 27]

/** Whole days from today to an ISO day; 0 is today, negative is past. */
export function joursAvant(isoDay: string, now: Date): number {
  const jour = new Date(`${isoDay.slice(0, 10)}T00:00:00`)
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((jour.getTime() - aujourdhui.getTime()) / JOUR_MS)
}

/** A small seeded generator: the same seed gives the same order. */
function hasard(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function graineDuJour(now: Date): number {
  const texte = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  let h = 2166136261
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619)
  return h >>> 0
}

function melanger<T>(liste: T[], graine: number): T[] {
  const copie = [...liste]
  const tirer = hasard(graine)
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(tirer() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/**
 * The tiles, in the order of the day. A work that is only wished is an
 * "ENVIE"; the soonest releases are "SORTIE" (a work with a release to come
 * is shown by that sign alone); the latest arrival of the last month is
 * "NOUVEAU". Ideas are put at fixed places.
 */
export function construireMur(oeuvres: WorkProgressDto[], idees: Idee[], now: Date): Tuile[] {
  const sorties = new Map<string, number>()
  oeuvres
    .filter((o) => o.nextReleaseDate)
    .map((o) => ({ id: o.entityId, jours: joursAvant(o.nextReleaseDate!, now) }))
    .filter((s) => s.jours >= 0)
    .sort((a, b) => a.jours - b.jours)
    .slice(0, SORTIES_MAX)
    .forEach((s) => sorties.set(s.id, s.jours))

  const recent = oeuvres
    .filter((o) => o.ownedCount > 0 && o.lastMovedAt && !sorties.has(o.entityId))
    .sort((a, b) => (b.lastMovedAt ?? '').localeCompare(a.lastMovedAt ?? ''))[0]
  const nouveauId =
    recent && (now.getTime() - new Date(recent.lastMovedAt!).getTime()) / JOUR_MS <= NOUVEAU_JOURS ? recent.entityId : null

  const oeuvresTuiles: Tuile[] = oeuvres
    .filter((o) => o.ownedCount > 0 || o.wishedCount > 0)
    .map((o) => {
      const base = { cle: o.entityId, titre: o.title, couverture: o.coverImageUrl, to: `/entity/${o.entityId}`, entityTypeId: o.entityTypeId }
      if (sorties.has(o.entityId)) return { ...base, signe: 'SORTIE' as const, jours: sorties.get(o.entityId) }
      if (o.ownedCount === 0) return { ...base, signe: 'ENVIE' as const }
      if (o.entityId === nouveauId) return { ...base, signe: 'NOUVEAU' as const }
      return { ...base, signe: null }
    })

  const melange = melanger(oeuvresTuiles, graineDuJour(now))
  idees.forEach((idee, i) => {
    const place = PLACES_DES_IDEES[i] ?? melange.length
    melange.splice(Math.min(place, melange.length), 0, {
      cle: `idee-${idee.title}`,
      titre: idee.title,
      couverture: idee.imageUrl,
      to: `/add?q=${encodeURIComponent(idee.title)}`,
      entityTypeId: idee.entityTypeId,
      signe: 'IDEE',
    })
  })
  return melange
}
