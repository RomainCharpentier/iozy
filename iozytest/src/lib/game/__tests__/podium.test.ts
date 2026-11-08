/**
 * Podium de fin de partie : ordre du classement et égalités.
 */
import type { Player } from '@/lib/game/types'
import { buildPodium, rankLabel, rankPlayers } from '@/lib/game/podium'

const p = (id: string, score: number, name = id): Player => ({ id, name, score })
const ranks = (players: Player[]) =>
  rankPlayers(players).map(({ player, rank }) => `${player.id}:${rank}`)

describe('rankPlayers', () => {
  it('classe par score décroissant', () => {
    expect(ranks([p('c', 1), p('a', 5), p('b', 3)])).toEqual(['a:1', 'b:2', 'c:3'])
  })

  it('égalité : même rang, et le suivant prend le rang de sa place', () => {
    expect(ranks([p('a', 9), p('b', 9), p('c', 7)])).toEqual(['a:1', 'b:1', 'c:3'])
    expect(ranks([p('a', 9), p('b', 7), p('c', 7), p('d', 2)])).toEqual([
      'a:1',
      'b:2',
      'c:2',
      'd:4',
    ])
  })

  it('à score égal, ordre stable par nom (sans tenir compte de la casse)', () => {
    expect(ranks([p('1', 4, 'zoé'), p('2', 4, 'Anna'), p('3', 4, 'max')])).toEqual([
      '2:1',
      '3:1',
      '1:1',
    ])
  })

  it('ne modifie pas la liste reçue', () => {
    const players = [p('a', 1), p('b', 2)]
    rankPlayers(players)
    expect(players.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('buildPodium', () => {
  it('trois marches, le reste en liste', () => {
    const podium = buildPodium([p('a', 9), p('b', 7), p('c', 5), p('d', 3), p('e', 1)])
    expect(podium.steps.map((s) => [s.rank, s.score, s.players.map((x) => x.id)])).toEqual([
      [1, 9, ['a']],
      [2, 7, ['b']],
      [3, 5, ['c']],
    ])
    expect(podium.rest.map(({ player, rank }) => [player.id, rank])).toEqual([
      ['d', 4],
      ['e', 5],
    ])
    expect(podium.leaders.map((x) => x.id)).toEqual(['a'])
  })

  it('égalité en tête : une seule marche porte les deux, la suivante est la 3e', () => {
    const podium = buildPodium([p('a', 9), p('b', 9), p('c', 7), p('d', 6)])
    expect(podium.steps.map((s) => [s.rank, s.players.map((x) => x.id)])).toEqual([
      [1, ['a', 'b']],
      [3, ['c']],
    ])
    expect(podium.rest.map(({ player, rank }) => [player.id, rank])).toEqual([['d', 4]])
    expect(podium.leaders.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('égalité à la 3e place : tous montent sur la marche', () => {
    const podium = buildPodium([p('a', 9), p('b', 7), p('c', 5), p('d', 5), p('e', 2)])
    expect(podium.steps[2]).toEqual({ rank: 3, score: 5, players: [p('c', 5), p('d', 5)] })
    expect(podium.rest.map(({ player, rank }) => [player.id, rank])).toEqual([['e', 5]])
  })

  it('à zéro point, on ne monte pas sur le podium', () => {
    const podium = buildPodium([p('a', 3), p('b', 0), p('c', 0)])
    expect(podium.steps.map((s) => s.rank)).toEqual([1])
    expect(podium.rest.map(({ player, rank }) => [player.id, rank])).toEqual([
      ['b', 2],
      ['c', 2],
    ])
  })

  it('personne n’a marqué : pas de marche, pas de vainqueur, tout le monde en liste', () => {
    const podium = buildPodium([p('a', 0), p('b', 0)])
    expect(podium.steps).toEqual([])
    expect(podium.leaders).toEqual([])
    expect(podium.rest).toHaveLength(2)
  })

  it('un seul joueur', () => {
    const podium = buildPodium([p('a', 4)])
    expect(podium.steps).toHaveLength(1)
    expect(podium.rest).toEqual([])
  })
})

describe('rankLabel', () => {
  it('1er, 2e, 3e', () => {
    expect([1, 2, 3, 4].map(rankLabel)).toEqual(['1er', '2e', '3e', '4e'])
  })
})
