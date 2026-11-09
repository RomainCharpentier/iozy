import { describe, expect, it } from 'vitest'
import type { WorkProgressDto } from '@/common/types/api'
import type { SharedSpaceDto } from '@/common/types/share'
import {
  candidats,
  detailValeur,
  etatListe,
  jaquetteDeFond,
  jaquettesDuPartage,
  resumeEspace,
  titreEspace,
} from './libelles'
import { contenuBilan } from './bilanImage'

function oeuvre(id: string, titre: string, possedes: number, jaquette: string | null = null): WorkProgressDto {
  return {
    entityId: id,
    entityTypeId: 't',
    title: titre,
    coverImageUrl: jaquette,
    collectorStatus: 'ONGOING',
    ownedCount: possedes,
    totalCount: null,
    missingCount: 0,
    wishedCount: possedes > 0 ? 0 : 1,
    nextReleaseDate: null,
    lastMovedAt: null,
  }
}

const espace: SharedSpaceDto = {
  collection: [{ label: 'Manga', items: [{ title: 'Akira', coverImageUrl: 'akira.jpg', editions: [], ownedVolumeCount: 2, totalVolumes: 6 }] }],
  wishlist: [{ title: 'Pluto', coverImageUrl: 'pluto.jpg', addedAt: '2026-11-01' }],
  tierLists: null,
  pinned: [{ title: 'Frieren', coverImageUrl: 'frieren.jpg', ownedCount: 3, totalCount: 13 }],
  value: null,
  giftList: false,
  expiresAt: null,
}

describe('the public page in words', () => {
  it('names a gift list as such, whatever else it carries', () => {
    expect(titreEspace({ ...espace, collection: null, giftList: true })).toBe('Liste de cadeaux')
    expect(titreEspace(espace)).toBe('Collection et envies partagées')
  })

  it('counts what is shown and says it is read-only', () => {
    expect(resumeEspace(espace)).toBe('1 œuvre · 1 catégorie · 1 envie · en lecture seule')
  })

  it('says what the value rests on', () => {
    expect(detailValeur({ totalKnownValue: 120, pricedCount: 12, totalCount: 20 })).toBe(
      'd’après le prix neuf de 12 objets sur 20',
    )
  })

  it('takes the backdrop from the first pinned work', () => {
    expect(jaquetteDeFond(espace)).toBe('frieren.jpg')
    expect(jaquetteDeFond({ ...espace, pinned: null })).toBe('akira.jpg')
  })
})

describe('the choice of the incontournables', () => {
  const oeuvres = [oeuvre('a', 'Akira', 2), oeuvre('b', 'Berserk', 0), oeuvre('c', 'Cowboy Bebop', 1)]

  it('offers only owned works that are not pinned yet', () => {
    expect(candidats(oeuvres, ['c'], '').map((o) => o.title)).toEqual(['Akira'])
  })

  it('filters by title, whatever the case', () => {
    expect(candidats(oeuvres, [], 'cow').map((o) => o.title)).toEqual(['Cowboy Bebop'])
  })

  it('puts the pinned covers first, then the owned ones', () => {
    const avecJaquettes = [oeuvre('a', 'Akira', 2, 'a.jpg'), oeuvre('b', 'Berserk', 0, 'b.jpg'), oeuvre('c', 'Cowboy', 1, 'c.jpg')]
    expect(jaquettesDuPartage(avecJaquettes, ['c'])).toEqual(['c.jpg', 'a.jpg'])
  })
})

describe('the gift list', () => {
  it('says when it expires, and that it has', () => {
    expect(etatListe({ token: 't', expiresAt: '2026-12-09T10:00:00Z', expired: false })).toBe('Expire le 9 décembre 2026')
    expect(etatListe({ token: 't', expiresAt: '2026-10-09T10:00:00Z', expired: true })).toBe(
      'Ce lien a expiré : prolonge-le pour qu’il remarche.',
    )
  })
})

describe('the image of the year', () => {
  const resume = { totalObjects: 35, addedThisMonth: 2, addedThisMonthByType: [], byType: [] }
  const recap = {
    year: 2026,
    acquisitionsCount: 12,
    acquisitionsByType: [],
    seriesStartedCount: 3,
    experiencesCount: 0,
    averageRating: null,
    mostFeaturedCreator: null,
    mostFeaturedCreatorCount: 0,
    availableYears: [2026],
  }

  it('writes the big numbers of the year', () => {
    const contenu = contenuBilan({ annee: 2026, resume, recap, valeur: null })
    expect(contenu.titre).toBe('Mon année 2026')
    expect(contenu.chiffres.map((c) => `${c.valeur} ${c.libelle}`)).toEqual([
      '35 objets dans ma collection',
      '12 ajouts en 2026',
      '3 séries commencées',
    ])
  })

  it('shows no money value unless the server gave one (enough prices)', () => {
    const sans = contenuBilan({ annee: 2026, resume, recap, valeur: null })
    expect(sans.chiffres.some((c) => c.valeur.includes('€'))).toBe(false)

    const avec = contenuBilan({ annee: 2026, resume, recap, valeur: { totalKnownValue: 412.5, pricedCount: 30, totalCount: 35 } })
    expect(avec.chiffres.at(-1)).toEqual({ valeur: '412,50 €', libelle: 'de valeur estimée' })
  })
})
