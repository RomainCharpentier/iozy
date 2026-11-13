import { formaterEuros } from '@/common/lib/formats'
import { libelleElements, libelleSortie, titreLigne } from '@/common/lib/libellesAchat'
import { parseReleaseDate } from '@/common/lib/releaseDate'
import type { MonthSpendingDto, ToBuyLineDto, WorkProgressDto } from '@/common/types/api'

/**
 * The wall of the home page (lot 219): only what moves in the collection,
 * set as a mosaic of square covers and a few blocks of colour.
 *
 * <h2>What a tile is</h2>
 * - ARRIVEE: a work that came in this month, in its own colours.
 * - SORTIE: a volume or a game announced, grey, with its days to go.
 * - COMPLETER: a series that lacks volumes already out: its cover, then the
 *   missing ones darkened, with their numbers. One block, read as a sequence.
 * - ENVIE: a wish, darkened.
 * - IDEE: a work an AI proposes, tinted with one colour of the palette.
 * - PAVE: a block of colour with a figure and a few words.
 * What the collector simply owns, a finished series, a dropped one, is not on
 * the wall: it is in the collection.
 *
 * <h2>The order is a rhythm, not a shuffle</h2>
 * The tiles follow a fixed pattern of kinds (an arrival, a block, a release,
 * an idea…), so the colours and the sizes alternate whatever the data. Inside
 * one kind, the most pressing comes first. The grid fills its holes
 * (`grid-auto-flow: dense`), so the pattern never leaves a gap in the middle.
 */

export type Teinte = 'ocre' | 'vert' | 'rose' | 'bleu' | 'orange'
export type EtatImage = 'possede' | 'aAcheter' | 'aVenir' | 'idee'
export type GenreTuile = 'ARRIVEE' | 'SORTIE' | 'COMPLETER' | 'ENVIE' | 'IDEE' | 'ATTENTE' | 'PAVE' | 'AJOUTER'

export interface ImageTuile {
  cle: string
  src: string | null
  /** What the image shows when it does not load. */
  titre: string
  etat: EtatImage
  /** A figure on the cover now and then: the days to a release, the number of a missing volume. */
  chiffre: string | null
}

export interface Idee {
  title: string
  imageUrl: string | null
  entityTypeId: string | null
  why: string
}

export type ActionTuile =
  | { type: 'jeLAi'; ligne: ToBuyLineDto; libelle: string }
  | { type: 'envie'; idee: Idee; libelle: string }

export interface Tuile {
  cle: string
  genre: GenreTuile
  largeur: 1 | 2 | 3
  hauteur: 1 | 2
  /** What it is: shown on hover, and the start of its accessible name. */
  titre: string
  /** Why it is here, in a few words. */
  etat: string
  /** One more sentence, on the back. */
  detail: string | null
  teinte: Teinte
  /** Where a click on the front leads. */
  lien: string
  images: ImageTuile[]
  action: ActionTuile | null
  pave: { grand: string; petit: string } | null
}

export interface LigneAffiche {
  valeur: number
  texte: string
  teinte: Teinte
}

export interface Mur {
  tuiles: Tuile[]
  lignes: LigneAffiche[]
  /** Everything the wall follows, counted in works (not in volumes). */
  total: number
}

export interface EntreesMur {
  oeuvres: WorkProgressDto[]
  aAcheter: ToBuyLineDto[]
  idees: Idee[]
  /** The ideas are being asked: their places are kept with waiting tiles. */
  ideesEnCours: boolean
  mois: MonthSpendingDto | null
  now: Date
}

const JOUR_MS = 24 * 60 * 60 * 1000
export const ARRIVEE_JOURS = 30
export const SORTIE_JOURS = 90
const MAX = { ARRIVEE: 3, SORTIE: 4, COMPLETER: 3, ENVIE: 3, ATTENTE: 4 }
const TEINTES_IDEES: Teinte[] = ['rose', 'vert', 'ocre', 'bleu', 'orange']
const TOME = /^Tome (\d+)$/

/**
 * The pattern of the wall: one kind after another. A kind with nothing left
 * is skipped; what remains after the pattern follows, ideas first.
 */
const MOTIF: GenreTuile[] = [
  'ARRIVEE', 'PAVE', 'SORTIE', 'IDEE', 'SORTIE', 'PAVE', 'COMPLETER', 'IDEE', 'IDEE', 'PAVE',
  'ENVIE', 'COMPLETER', 'IDEE', 'ARRIVEE', 'SORTIE', 'IDEE', 'PAVE', 'ENVIE', 'IDEE', 'COMPLETER',
  'ARRIVEE', 'IDEE', 'PAVE', 'SORTIE', 'ENVIE', 'IDEE',
]
const RESTE: GenreTuile[] = ['IDEE', 'ATTENTE', 'SORTIE', 'COMPLETER', 'ENVIE', 'ARRIVEE', 'PAVE']

function pluriel(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un
}

/** A title as two spellings of it compare: no case, no accent, no punctuation. */
export function normaliser(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Whole days from today to a day; 0 is today, negative is past. */
export function joursAvant(isoDay: string, now: Date): number {
  const jour = new Date(`${isoDay.slice(0, 10)}T00:00:00`)
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((jour.getTime() - aujourdhui.getTime()) / JOUR_MS)
}

/** Whole days since an instant, by calendar day: 0 is today, 1 is yesterday. */
function joursDepuis(isoInstant: string, now: Date): number {
  const quand = new Date(isoInstant)
  const jour = new Date(quand.getFullYear(), quand.getMonth(), quand.getDate())
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((aujourdhui.getTime() - jour.getTime()) / JOUR_MS)
}

/** "aujourd’hui", "hier", "le 8 novembre". */
function quandArrive(isoInstant: string, now: Date): string {
  const jours = joursDepuis(isoInstant, now)
  if (jours <= 0) return 'aujourd’hui'
  if (jours === 1) return 'hier'
  return `le ${new Date(isoInstant).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
}

/** The release of an UPCOMING line, read: its days to go when known to the day. */
function sortieDe(ligne: ToBuyLineDto, now: Date): { jours: number | null; mois: string | null; date: string } | null {
  const parts = parseReleaseDate(ligne.releaseDate)
  if (!parts) return null
  if (parts.precision === 'DAY') {
    const jours = joursAvant(parts.iso, now)
    return jours < 0 || jours > SORTIE_JOURS ? null : { jours, mois: null, date: parts.iso }
  }
  const debutDuMois = new Date(parts.year, parts.month - 1, 1)
  const ecart = (debutDuMois.getTime() - new Date(now.getFullYear(), now.getMonth(), 1).getTime()) / JOUR_MS
  if (ecart < 0 || ecart > SORTIE_JOURS) return null
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(debutDuMois)
  return { jours: null, mois, date: parts.iso }
}

/** "6 j", "1 j", "Auj.": the figure on a cover. */
function chiffreJours(jours: number): string {
  return jours === 0 ? 'Auj.' : `${jours} j`
}

/** "Sort aujourd’hui", "Sort demain", "Sort mercredi 18 novembre", "Sort en décembre 2026". */
function phraseSortie(date: string, jours: number | null): string {
  if (jours === 0) return 'Sort aujourd’hui'
  if (jours === 1) return 'Sort demain'
  return `Sort ${libelleSortie(date)}`
}

function couverture(ligne: ToBuyLineDto, index = 0): string | null {
  return ligne.elements[index]?.coverImageUrl ?? ligne.coverImageUrl
}

/** "J’ai le tome 108", or "Je l’ai" when the element is not a numbered volume. */
function libelleJeLAi(ligne: ToBuyLineDto): string {
  const premier = ligne.elements[0]
  return premier && TOME.test(premier.label) && premier.number != null ? `J’ai le tome ${premier.number}` : 'Je l’ai'
}

function tuileDeBase(patch: Partial<Tuile> & Pick<Tuile, 'cle' | 'genre' | 'titre' | 'etat' | 'teinte' | 'lien'>): Tuile {
  return { largeur: 1, hauteur: 1, detail: null, images: [], action: null, pave: null, ...patch }
}

/** The tiles of each kind, the most pressing first, before the pattern sets them. */
function parGenre(entrees: EntreesMur) {
  const { oeuvres, aAcheter, idees, ideesEnCours, now } = entrees
  const vivantes = aAcheter.filter((l) => l.collectorStatus !== 'DROPPED' && l.elements.length > 0)

  const sorties = vivantes
    .filter((l) => l.kind === 'UPCOMING')
    .map((l) => ({ ligne: l, sortie: sortieDe(l, now) }))
    .filter((x): x is { ligne: ToBuyLineDto; sortie: NonNullable<ReturnType<typeof sortieDe>> } => x.sortie !== null)
    .sort((a, b) => a.sortie.date.localeCompare(b.sortie.date))

  const completer = vivantes.filter((l) => l.kind === 'COMPLETE').sort((a, b) => a.elements.length - b.elements.length)
  const envies = vivantes.filter((l) => l.kind === 'WISH')

  // A work already on the wall for what it lacks is not shown again as an arrival.
  const dejaLa = new Set([...sorties.map((s) => s.ligne.entityId), ...completer.map((l) => l.entityId)])
  const arrivees = oeuvres
    .filter((o) => o.ownedCount > 0 && o.lastMovedAt && joursDepuis(o.lastMovedAt, now) <= ARRIVEE_JOURS)
    .filter((o) => !dejaLa.has(o.entityId))
    .sort((a, b) => (b.lastMovedAt ?? '').localeCompare(a.lastMovedAt ?? ''))

  // An idea the collector has since wished or bought is no longer an idea.
  const connus = new Set(oeuvres.map((o) => normaliser(o.title)))
  const ideesNeuves = idees.filter((i) => !connus.has(normaliser(i.title)))

  return { sorties, completer, envies, arrivees, idees: ideesNeuves, ideesEnCours: ideesEnCours && ideesNeuves.length === 0 }
}

/**
 * The wall of the home page, from what the server knows: the works, what
 * there is to buy, the month spent, and the ideas. A pure function: the same
 * data and the same day give the same wall.
 */
export function composerMur(entrees: EntreesMur): Mur {
  const { now, mois } = entrees
  const g = parGenre(entrees)
  const files: Record<GenreTuile, Tuile[]> = {
    ARRIVEE: [], SORTIE: [], COMPLETER: [], ENVIE: [], IDEE: [], ATTENTE: [], PAVE: [], AJOUTER: [],
  }

  g.arrivees.slice(0, MAX.ARRIVEE).forEach((o, i) => {
    const detail =
      o.missingCount > 0
        ? `Il t’en manque ${o.missingCount} déjà ${pluriel(o.missingCount, 'paru', 'parus')}.`
        : o.totalCount != null && o.ownedCount >= o.totalCount
          ? 'Tu as tout ce qui est paru.'
          : null
    files.ARRIVEE.push(
      tuileDeBase({
        cle: `arrivee-${o.entityId}`,
        genre: 'ARRIVEE',
        largeur: i === 0 ? 2 : 1,
        hauteur: i === 0 ? 2 : 1,
        titre: o.title,
        etat: `Arrivé ${quandArrive(o.lastMovedAt!, now)}`,
        detail,
        teinte: 'bleu',
        lien: `/entity/${o.entityId}`,
        images: [{ cle: o.entityId, src: o.coverImageUrl, titre: o.title, etat: 'possede', chiffre: null }],
      }),
    )
  })

  g.sorties.slice(0, MAX.SORTIE).forEach(({ ligne, sortie }) => {
    const voulu = ligne.elements[0].state === 'WANTED'
    files.SORTIE.push(
      tuileDeBase({
        cle: `sortie-${ligne.entityId}-${ligne.elements[0].key}`,
        genre: 'SORTIE',
        titre: titreLigne({ ...ligne, elements: [ligne.elements[0]] }),
        etat: phraseSortie(sortie.date, sortie.jours),
        detail: voulu ? 'Il est dans tes envies.' : 'Il suit ta collection.',
        teinte: 'vert',
        lien: `/entity/${ligne.entityId}`,
        images: [
          {
            cle: ligne.elements[0].key,
            src: couverture(ligne),
            titre: ligne.title,
            etat: 'aVenir',
            chiffre: sortie.jours !== null ? chiffreJours(sortie.jours) : sortie.mois,
          },
        ],
      }),
    )
  })

  g.completer.slice(0, MAX.COMPLETER).forEach((ligne) => {
    const n = ligne.elements.length
    const manquants = ligne.elements.slice(0, 2).map((element, i) => ({
      cle: element.key,
      src: element.coverImageUrl ?? ligne.coverImageUrl,
      titre: `${ligne.title} ${element.label}`,
      etat: 'aAcheter' as const,
      // The last shown says how many more there are, when they do not fit.
      chiffre: i === 1 && n > 2 ? `+${n - 1}` : element.number != null ? String(element.number) : null,
    }))
    files.COMPLETER.push(
      tuileDeBase({
        cle: `completer-${ligne.entityId}`,
        genre: 'COMPLETER',
        largeur: (1 + manquants.length) as 2 | 3,
        titre: ligne.title,
        etat: n === 1 ? 'Le dernier qui te manque' : `Il t’en manque ${n}`,
        detail: `${libelleElements(ligne.elements)}.`,
        teinte: 'ocre',
        lien: `/entity/${ligne.entityId}`,
        images: [{ cle: 'oeuvre', src: ligne.coverImageUrl, titre: ligne.title, etat: 'possede', chiffre: null }, ...manquants],
        action: { type: 'jeLAi', ligne, libelle: libelleJeLAi(ligne) },
      }),
    )
  })

  g.envies.slice(0, MAX.ENVIE).forEach((ligne) => {
    files.ENVIE.push(
      tuileDeBase({
        cle: `envie-${ligne.entityId}-${ligne.elements[0].key}`,
        genre: 'ENVIE',
        titre: titreLigne(ligne),
        etat: 'Dans tes envies',
        teinte: 'orange',
        lien: `/entity/${ligne.entityId}`,
        images: [{ cle: ligne.elements[0].key, src: couverture(ligne), titre: ligne.title, etat: 'aAcheter', chiffre: null }],
        action: { type: 'jeLAi', ligne, libelle: libelleJeLAi(ligne) },
      }),
    )
  })

  g.idees.forEach((idee, i) => {
    const grande = i === 0 && g.idees.length >= 3
    files.IDEE.push(
      tuileDeBase({
        cle: `idee-${normaliser(idee.title)}`,
        genre: 'IDEE',
        largeur: grande ? 2 : 1,
        hauteur: grande ? 2 : 1,
        titre: idee.title,
        etat: 'Idée d’une IA',
        detail: idee.why || null,
        teinte: TEINTES_IDEES[i % TEINTES_IDEES.length],
        lien: `/add?q=${encodeURIComponent(idee.title)}`,
        images: [{ cle: 'idee', src: idee.imageUrl, titre: idee.title, etat: 'idee', chiffre: null }],
        action: idee.entityTypeId ? { type: 'envie', idee, libelle: 'Ajouter à mes envies' } : null,
      }),
    )
  })

  if (g.ideesEnCours) {
    for (let i = 0; i < MAX.ATTENTE; i++) {
      files.ATTENTE.push(
        tuileDeBase({
          cle: `attente-${i}`,
          genre: 'ATTENTE',
          titre: 'Une idée arrive',
          etat: 'Une IA cherche des idées dans le catalogue',
          teinte: TEINTES_IDEES[i % TEINTES_IDEES.length],
          lien: '',
        }),
      )
    }
  }

  files.PAVE = paves(g, mois, now)

  // The pattern, then what is left: ideas and their waiting tiles share the IDEE slots.
  const tuiles: Tuile[] = []
  const prendre = (genre: GenreTuile): boolean => {
    const file = genre === 'IDEE' && files.IDEE.length === 0 ? files.ATTENTE : files[genre]
    const tuile = file.shift()
    if (tuile) tuiles.push(tuile)
    return !!tuile
  }
  MOTIF.forEach(prendre)
  let reste = true
  while (reste) {
    reste = false
    for (const genre of RESTE) reste = prendre(genre) || reste
  }
  if (tuiles.length > 0) {
    tuiles.push(
      tuileDeBase({ cle: 'ajouter', genre: 'AJOUTER', titre: 'Ajouter une œuvre', etat: 'Chercher ou ajouter', teinte: 'ocre', lien: '/add' }),
    )
  }

  const tomes = g.completer.reduce((s, l) => s + l.elements.length, 0)
  const premiere = g.sorties[0]?.sortie
  const lignes: LigneAffiche[] = [
    g.idees.length > 0 && {
      valeur: g.idees.length,
      texte: `${pluriel(g.idees.length, 'idée', 'idées')} pour toi, ${pluriel(g.idees.length, 'choisie', 'choisies')} par une IA.`,
      teinte: 'rose' as Teinte,
    },
    g.sorties.length > 0 && {
      valeur: g.sorties.length,
      texte:
        `${pluriel(g.sorties.length, 'sortie', 'sorties')} à venir` +
        (premiere?.jours === 0
          ? ', une aujourd’hui.'
          : premiere?.jours != null
            ? `, la première dans ${premiere.jours} ${pluriel(premiere.jours, 'jour', 'jours')}.`
            : '.'),
      teinte: 'vert' as Teinte,
    },
    tomes > 0 && {
      valeur: tomes,
      texte: `${pluriel(tomes, 'tome', 'tomes')} à acheter pour finir ${g.completer.length} ${pluriel(g.completer.length, 'série', 'séries')}.`,
      teinte: 'ocre' as Teinte,
    },
    g.envies.length > 0 && {
      valeur: g.envies.length,
      texte: `${pluriel(g.envies.length, 'envie qui attend', 'envies qui attendent')}.`,
      teinte: 'orange' as Teinte,
    },
    g.arrivees.length > 0 && {
      valeur: g.arrivees.length,
      texte: `${pluriel(g.arrivees.length, 'arrivée', 'arrivées')} ces trente derniers jours.`,
      teinte: 'bleu' as Teinte,
    },
  ].filter((l): l is LigneAffiche => !!l)

  const total = g.idees.length + g.sorties.length + g.completer.length + g.envies.length + g.arrivees.length
  return { tuiles, lignes, total }
}

/** The blocks of colour: each one only when its figure exists. */
function paves(g: ReturnType<typeof parGenre>, mois: MonthSpendingDto | null, now: Date): Tuile[] {
  const paves: Tuile[] = []
  const prochaine = g.sorties.find((s) => s.sortie.jours !== null)
  if (prochaine) {
    const jours = prochaine.sortie.jours!
    const titre = titreLigne({ ...prochaine.ligne, elements: [prochaine.ligne.elements[0]] })
    paves.push(
      tuileDeBase({
        cle: 'pave-sortie',
        genre: 'PAVE',
        titre: 'La prochaine sortie',
        etat: jours === 0 ? `${titre} sort aujourd’hui.` : `${jours} ${pluriel(jours, 'jour', 'jours')} avant ${titre}.`,
        teinte: 'vert',
        lien: '/releases',
        pave: { grand: chiffreJours(jours), petit: jours === 0 ? `${titre} sort aujourd’hui.` : `avant ${titre}.` },
      }),
    )
  }
  const proche = g.completer[0]
  if (proche) {
    const n = proche.elements.length
    const queDesTomes = proche.elements.every((e) => TOME.test(e.label))
    const combien = queDesTomes ? `${n} ${pluriel(n, 'tome', 'tomes')}` : String(n)
    paves.push(
      tuileDeBase({
        cle: 'pave-completer',
        genre: 'PAVE',
        largeur: 2,
        titre: 'À acheter',
        etat: `${combien} et ${proche.title} est à jour.`,
        teinte: 'ocre',
        lien: '/to-buy',
        pave: { grand: combien, petit: `et ${proche.title} est à jour.` },
      }),
    )
  }
  if (mois && (mois.monthlyBudget != null || mois.spent > 0)) {
    const budget = mois.monthlyBudget
    const ecart = budget != null ? budget - mois.spent : null
    const grand = formaterEuros(ecart != null ? Math.abs(ecart) : mois.spent)
    const petit =
      ecart == null ? 'dépensés ce mois-ci.' : ecart >= 0 ? 'de budget restant ce mois-ci.' : 'au-dessus de ton budget ce mois-ci.'
    paves.push(
      tuileDeBase({ cle: 'pave-budget', genre: 'PAVE', titre: 'Ton budget', etat: `${grand} ${petit}`, teinte: 'orange', lien: '/to-buy', pave: { grand, petit } }),
    )
  }
  const ceMois = g.arrivees.filter((o) => {
    const quand = new Date(o.lastMovedAt!)
    return quand.getFullYear() === now.getFullYear() && quand.getMonth() === now.getMonth()
  }).length
  if (ceMois >= 2) {
    paves.push(
      tuileDeBase({
        cle: 'pave-arrivees',
        genre: 'PAVE',
        titre: 'Ce mois-ci',
        etat: `${ceMois} arrivées ce mois-ci.`,
        teinte: 'bleu',
        lien: '/collection',
        pave: { grand: String(ceMois), petit: 'œuvres arrivées ce mois-ci.' },
      }),
    )
  }
  return paves
}
