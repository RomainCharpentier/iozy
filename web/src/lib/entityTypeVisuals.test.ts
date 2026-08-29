/**
 * <b>L'identité visuelle d'un univers — et pourquoi ces listes sont fermées.</b>
 *
 * Une couleur d'univers n'est pas décorative : elle sert aussi de TEXTE (le
 * « Tout voir » d'un rail, le titre d'une page catégorie). Une teinte choisie
 * à l'œil serait illisible dans un thème sur deux, ce que le Lot 12 a eu à
 * corriger. D'où une palette fermée, des icônes qui sont des composants
 * importés, et des classes d'aspect écrites en dur - une classe construite
 * dynamiquement n'existerait tout simplement pas dans le CSS produit.
 *
 * <p>La règle qui se casse en silence : une clé <b>inconnue</b> (palette
 * élargie ailleurs, donnée saisie à la main, type importé d'une autre
 * instance) ne doit rien casser ni rien blanchir - elle retombe sur le visuel
 * de base.
 */
import { describe, expect, it } from 'vitest'
import {
  UNIVERSE_ASPECTS,
  UNIVERSE_ICONS,
  UNIVERSE_PALETTE,
  colorVarFor,
  getEntityTypeVisual,
} from './entityTypeVisuals'
import { typeDeCollection } from '../test/fixtures'

describe('les univers livrés', () => {
  it('portent chacun leur couleur et leur format de jaquette', () => {
    expect(getEntityTypeVisual('MANGA').aspectClassName).toBe('aspect-[2/3]')
    expect(getEntityTypeVisual('VIDEO_GAME').aspectClassName).toBe('aspect-[3/4]')
    expect(getEntityTypeVisual('BOARD_GAME').aspectClassName).toBe('aspect-square')
  })

  it('ne partagent pas la même couleur', () => {
    const couleurs = ['MANGA', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK'].map((c) => getEntityTypeVisual(c).color)

    expect(new Set(couleurs).size).toBe(4)
  })

  it('délèguent leur couleur à un token CSS, jamais à une valeur en dur', () => {
    // C'est ce qui permet à la teinte de rester la même dans les deux thèmes
    // pendant que seule la luminosité s'adapte.
    for (const code of ['MANGA', 'VIDEO_GAME', 'BOARD_GAME', 'BOOK']) {
      expect(getEntityTypeVisual(code).color).toMatch(/^var\(--color-/)
    }
  })
})

describe('un type créé par l’utilisateur', () => {
  it('voit son choix l’emporter, y compris sur un univers livré', () => {
    const manga = { ...typeDeCollection('MANGA'), colorKey: 'cyan', aspectKey: 'carre' }

    const visuel = getEntityTypeVisual(manga)

    expect(visuel.color).toBe(colorVarFor('cyan'))
    expect(visuel.aspectClassName).toBe('aspect-square')
  })

  it('garde le visuel de base pour ce qu’il n’a pas choisi', () => {
    const manga = { ...typeDeCollection('MANGA'), colorKey: 'cyan' }

    expect(getEntityTypeVisual(manga).aspectClassName).toBe('aspect-[2/3]')
  })

  it('retombe sur le repli quand une clé est inconnue, sans rien casser', () => {
    const exotique = { ...typeDeCollection('VINYL'), colorKey: 'fuchsia', iconKey: 'licorne', aspectKey: 'triangle' }

    const visuel = getEntityTypeVisual(exotique)

    expect(visuel.color).toBe('var(--color-accent)')
    expect(visuel.aspectClassName).toBe('aspect-[2/3]')
    expect(visuel.icon).toBeTypeOf('object')
  })

  it('a un visuel même sans aucun type sous la main', () => {
    expect(getEntityTypeVisual(undefined).color).toBe('var(--color-accent)')
  })
})

describe('les listes proposées au choix', () => {
  it('n’offrent que des clés que le rendu sait traduire', () => {
    for (const { key } of UNIVERSE_PALETTE) {
      expect(colorVarFor(key)).not.toBe('var(--color-accent)')
    }
  })

  it('n’ont aucune clé en double', () => {
    expect(new Set(UNIVERSE_PALETTE.map((c) => c.key)).size).toBe(UNIVERSE_PALETTE.length)
    expect(new Set(UNIVERSE_ICONS.map((i) => i.key)).size).toBe(UNIVERSE_ICONS.length)
    expect(new Set(UNIVERSE_ASPECTS.map((a) => a.key)).size).toBe(UNIVERSE_ASPECTS.length)
  })

  it('n’écrivent que des classes d’aspect complètes, jamais construites', () => {
    // Une classe assemblée à l'exécution (`aspect-[${ratio}]`) n'est pas
    // extraite par Tailwind : elle n'existerait pas dans le CSS produit.
    for (const { className } of UNIVERSE_ASPECTS) {
      expect(className).toMatch(/^aspect-(square|\[[\d/]+\])$/)
    }
  })
})
