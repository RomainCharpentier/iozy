/**
 * <b>Le garde-fou de la fonctionnalité IA, réduit à deux fonctions.</b>
 *
 * Une donnée produite par un modèle de langage ne doit JAMAIS être présentée
 * comme une donnée réelle. Quatre écrans traduisaient cet enum chacun dans son
 * coin, et l'un d'eux - écrit avant que l'IA existe - posait « (marché) » sur
 * tout ce qui n'était pas théorique, donc sur une estimation IA.
 *
 * <p>Le cas `null` compte autant que les trois autres : ne rien écrire vaut
 * mieux qu'affirmer une origine qu'on ne connaît pas. Un repli sur
 * « théorique » serait une invention.
 */
import { describe, expect, it } from 'vitest'
import { libelleBaseCourt, libelleBaseLong } from './basePrix'

describe('libelleBaseCourt', () => {
  it('nomme les trois origines distinctement', () => {
    expect(libelleBaseCourt('OBSERVED_MARKET')).toBe('marché')
    expect(libelleBaseCourt('AI_ESTIMATED')).toBe('estimation IA')
    expect(libelleBaseCourt('THEORETICAL_ONLY')).toBe('théorique')
  })

  it('n’écrit rien quand l’origine est inconnue', () => {
    expect(libelleBaseCourt(null)).toBeNull()
  })
})

describe('libelleBaseLong', () => {
  it('dit d’une estimation IA qu’elle n’est pas vérifiée', () => {
    expect(libelleBaseLong('AI_ESTIMATED')).toBe('estimation IA, non vérifiée')
  })

  it('réserve le mot « observés » aux vrais relevés', () => {
    expect(libelleBaseLong('OBSERVED_MARKET')).toBe('prix de marché observés')
    expect(libelleBaseLong('THEORETICAL_ONLY')).not.toContain('observ')
    expect(libelleBaseLong('AI_ESTIMATED')).not.toContain('observ')
  })

  it('n’écrit rien quand l’origine est inconnue', () => {
    expect(libelleBaseLong(null)).toBeNull()
  })
})

describe('les deux registres', () => {
  it('disent le même sens, jamais deux origines différentes', () => {
    // Le court est une incise derrière un montant, le long une phrase de
    // l'assistant : deux places, un seul sens écrit une fois.
    expect(libelleBaseLong('AI_ESTIMATED')).toContain(libelleBaseCourt('AI_ESTIMATED') as string)
    expect(libelleBaseLong('THEORETICAL_ONLY')).toContain('théorique')
  })
})
