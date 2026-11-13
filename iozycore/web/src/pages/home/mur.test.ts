import { describe, expect, it } from 'vitest'
import type { MonthSpendingDto, ToBuyElementDto, ToBuyLineDto, WorkProgressDto } from '@/common/types/api'
import { composerMur, type EntreesMur, type Idee } from './mur'

// A Friday at noon, local time: "today" for every test.
const NOW = new Date(2026, 10, 13, 12, 0, 0)

function tome(n: number, state: ToBuyElementDto['state'] = 'MISSING'): ToBuyElementDto {
  return { key: `volume-${n}`, label: `Tome ${n}`, number: n, coverImageUrl: `/c/${n}.jpg`, state, releaseDate: null }
}

function ligne(patch: Partial<ToBuyLineDto>): ToBuyLineDto {
  return {
    entityId: 'e1',
    entityTypeId: 't1',
    title: 'One Piece',
    coverImageUrl: '/c/op.jpg',
    kind: 'COMPLETE',
    collectorStatus: 'ONGOING',
    releaseDate: null,
    releasePrecision: null,
    elements: [tome(108)],
    ...patch,
  }
}

function oeuvre(patch: Partial<WorkProgressDto>): WorkProgressDto {
  return {
    entityId: 'w1',
    entityTypeId: 't1',
    title: 'Frieren',
    coverImageUrl: '/c/frieren.jpg',
    collectorStatus: 'ONGOING',
    ownedCount: 14,
    totalCount: 14,
    missingCount: 0,
    wishedCount: 0,
    nextReleaseDate: null,
    lastMovedAt: null,
    ...patch,
  }
}

function idee(title: string): Idee {
  return { title, imageUrl: `/c/${title}.jpg`, entityTypeId: 't1', why: `Parce que ${title}.` }
}

function mur(patch: Partial<EntreesMur>) {
  return composerMur({ oeuvres: [], aAcheter: [], idees: [], ideesEnCours: false, mois: null, now: NOW, ...patch })
}

describe('the wall of the home page', () => {
  it('leaves out what is simply owned: a finished series or one that did not move this month', () => {
    const { tuiles, total } = mur({
      oeuvres: [oeuvre({ lastMovedAt: '2026-08-01T10:00:00Z' }), oeuvre({ entityId: 'w2', title: 'Monster', lastMovedAt: null })],
    })
    expect(tuiles).toEqual([])
    expect(total).toBe(0)
  })

  it('shows an arrival of the last thirty days, the newest one big', () => {
    const { tuiles } = mur({
      oeuvres: [
        oeuvre({ entityId: 'a', title: 'Ancien', lastMovedAt: '2026-11-02T10:00:00Z' }),
        oeuvre({ entityId: 'b', title: 'Frieren', lastMovedAt: '2026-11-12T10:00:00Z' }),
      ],
    })
    const arrivees = tuiles.filter((t) => t.genre === 'ARRIVEE')
    expect(arrivees.map((t) => [t.titre, t.etat, t.largeur])).toEqual([
      ['Frieren', 'Arrivé hier', 2],
      ['Ancien', 'Arrivé le 2 novembre', 1],
    ])
  })

  it('puts the days to go on a release known to the day, and keeps far releases off the wall', () => {
    const { tuiles } = mur({
      aAcheter: [
        ligne({ entityId: 'bl', title: 'Blue Lock', kind: 'UPCOMING', releaseDate: '2026-11-19', elements: [tome(27, 'UPCOMING')] }),
        ligne({ entityId: 'far', title: 'Loin', kind: 'UPCOMING', releaseDate: '2027-06-01', elements: [tome(3, 'UPCOMING')] }),
      ],
    })
    const sorties = tuiles.filter((t) => t.genre === 'SORTIE')
    expect(sorties).toHaveLength(1)
    expect(sorties[0].titre).toBe('Blue Lock, tome 27')
    expect(sorties[0].etat).toBe('Sort jeudi 19 novembre')
    expect(sorties[0].images[0]).toMatchObject({ etat: 'aVenir', chiffre: '6 j' })
  })

  it('sets a series to complete as one block: its cover, then the missing volumes and how many more', () => {
    const { tuiles } = mur({ aAcheter: [ligne({ elements: [tome(100), tome(101), tome(102), tome(103)] })] })
    const bloc = tuiles.find((t) => t.genre === 'COMPLETER')!
    expect(bloc.largeur).toBe(3)
    expect(bloc.images.map((i) => [i.etat, i.chiffre])).toEqual([
      ['possede', null],
      ['aAcheter', '100'],
      ['aAcheter', '+3'],
    ])
    expect(bloc.etat).toBe('Il t’en manque 4')
    expect(bloc.action).toMatchObject({ type: 'jeLAi', libelle: 'J’ai le tome 100' })
  })

  it('never shows a dropped series, even when it lacks volumes', () => {
    const { tuiles } = mur({ aAcheter: [ligne({ collectorStatus: 'DROPPED' })] })
    expect(tuiles).toEqual([])
  })

  it('does not show a work twice: a series to complete is not also an arrival', () => {
    const { tuiles } = mur({
      oeuvres: [oeuvre({ entityId: 'e1', title: 'One Piece', lastMovedAt: '2026-11-12T10:00:00Z' })],
      aAcheter: [ligne({ entityId: 'e1' })],
    })
    expect(tuiles.filter((t) => t.titre === 'One Piece').map((t) => t.genre)).toEqual(['COMPLETER'])
  })

  it('drops an idea once it is in the collection or the wishes', () => {
    const { tuiles } = mur({
      oeuvres: [oeuvre({ title: 'Dandadan', ownedCount: 0, wishedCount: 1 })],
      idees: [idee('Dandadan'), idee('Monster')],
    })
    expect(tuiles.filter((t) => t.genre === 'IDEE').map((t) => t.titre)).toEqual(['Monster'])
  })

  it('gives ideas at least a third of the wall when they are there', () => {
    const { tuiles } = mur({
      oeuvres: [oeuvre({ entityId: 'n', title: 'Neuf', lastMovedAt: '2026-11-10T10:00:00Z' })],
      aAcheter: [
        ligne({ entityId: 's1', kind: 'UPCOMING', releaseDate: '2026-11-20', elements: [tome(5, 'UPCOMING')] }),
        ligne({ entityId: 's2', kind: 'UPCOMING', releaseDate: '2026-11-25', elements: [tome(6, 'UPCOMING')] }),
        ligne({ entityId: 'c1' }),
        ligne({ entityId: 'w', kind: 'WISH', elements: [{ ...tome(1, 'WANTED'), key: 'work' }] }),
      ],
      idees: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(idee),
    })
    const oeuvres = tuiles.filter((t) => !['PAVE', 'AJOUTER', 'ATTENTE'].includes(t.genre))
    const idees = oeuvres.filter((t) => t.genre === 'IDEE')
    expect(idees.length / oeuvres.length).toBeGreaterThanOrEqual(0.3)
  })

  it('keeps the places of the ideas with waiting tiles while they are asked', () => {
    const { tuiles } = mur({ aAcheter: [ligne({})], ideesEnCours: true })
    expect(tuiles.filter((t) => t.genre === 'ATTENTE')).toHaveLength(4)
  })

  it('makes a block of colour only for a figure that exists', () => {
    const sansRien = mur({ aAcheter: [ligne({ kind: 'WISH', elements: [{ ...tome(1, 'WANTED'), key: 'work' }] })] })
    expect(sansRien.tuiles.filter((t) => t.genre === 'PAVE')).toEqual([])

    const mois: MonthSpendingDto = { month: '2026-11', spent: 42.3, pricedCount: 3, unpricedCount: 0, monthlyBudget: 50 }
    const avec = mur({
      aAcheter: [
        ligne({ entityId: 'bl', title: 'Blue Lock', kind: 'UPCOMING', releaseDate: '2026-11-13', elements: [tome(27, 'UPCOMING')] }),
        ligne({ entityId: 'op', elements: [tome(108), tome(109)] }),
      ],
      mois,
    })
    const paves = Object.fromEntries(avec.tuiles.filter((t) => t.genre === 'PAVE').map((t) => [t.cle, t.pave]))
    expect(paves['pave-sortie']).toEqual({ grand: 'Auj.', petit: 'Blue Lock, tome 27 sort aujourd’hui.' })
    expect(paves['pave-completer']).toEqual({ grand: '2 tomes', petit: 'et One Piece est à jour.' })
    expect(paves['pave-budget']?.grand).toMatch(/^7,70\s€$/)
    expect(paves['pave-budget']?.petit).toBe('de budget restant ce mois-ci.')
  })

  it('colours each tile from a cover: its own, or the one of the work a block talks about (lot 233)', () => {
    const mois: MonthSpendingDto = { month: '2026-11', spent: 42.3, pricedCount: 3, unpricedCount: 0, monthlyBudget: 50 }
    const { tuiles } = mur({
      aAcheter: [
        ligne({ entityId: 'bl', title: 'Blue Lock', coverImageUrl: '/c/bl.jpg', kind: 'UPCOMING', releaseDate: '2026-11-13', elements: [tome(27, 'UPCOMING')] }),
        ligne({ entityId: 'op', elements: [tome(108), tome(109)] }),
      ],
      mois,
    })
    const couleur = Object.fromEntries(tuiles.map((t) => [t.cle, t.couleurDe]))
    // The block of the next release wears the cover of that volume, the block to complete the series'.
    expect(couleur['pave-sortie']).toBe('/c/27.jpg')
    expect(couleur['pave-completer']).toBe('/c/op.jpg')
    // The budget talks about no work: the colour of the page.
    expect(couleur['pave-budget']).toBeNull()
    // A tile with a cover wears its own.
    expect(couleur['completer-op']).toBe('/c/op.jpg')
  })

  it('counts on the poster what the wall follows, in works', () => {
    const { lignes, total } = mur({
      aAcheter: [
        ligne({ entityId: 'op', elements: [tome(108), tome(109)] }),
        ligne({ entityId: 'vs', title: 'Vinland Saga', elements: [tome(12)] }),
      ],
      idees: [idee('Monster')],
    })
    expect(total).toBe(3)
    expect(lignes.map((l) => `${l.valeur} ${l.texte}`)).toEqual([
      '1 idée pour toi, choisie par une IA.',
      '3 tomes à acheter pour finir 2 séries.',
    ])
  })

  it('ends with the tile to add a work, and only when there is a wall', () => {
    expect(mur({}).tuiles).toEqual([])
    const { tuiles } = mur({ idees: [idee('Monster')] })
    expect(tuiles[tuiles.length - 1].genre).toBe('AJOUTER')
  })
})
