/**
 * <b>The version number is deduced from the commits — and this is where it breaks.</b>
 *
 * No screen would show the error: a forgotten major, a `docs:` that
 * increments nothing, and two different releases carry the same number
 * without anyone seeing it before it is needed.
 */
import { describe, expect, it } from 'vitest'
import { apporteUneFonctionnalite, casseLExistant, lireEtiquette, versionApres } from './version.mjs'

describe('reading the starting tag', () => {
  it('accepts the vX.Y.Z form, and nothing else', () => {
    expect(lireEtiquette('v1.4.2')).toEqual([1, 4, 2])
    expect(lireEtiquette('  v10.0.7\n')).toEqual([10, 0, 7])
    // `version-379` is the tag of the first numbering attempt: it still lives
    // in the repository and must never be used as a starting point.
    expect(lireEtiquette('version-379')).toBeNull()
    expect(lireEtiquette('v1.4')).toBeNull()
  })
})

describe('what breaks existing behavior', () => {
  it('is recognized by the exclamation mark', () => {
    expect(casseLExistant('feat!: la session ne survit plus au redemarrage')).toBe(true)
    expect(casseLExistant('refactor(api)!: /entities rend une page, plus une liste')).toBe(true)
  })

  it('is also recognized by the message footer', () => {
    expect(casseLExistant('feat(api): pagination\n\nBREAKING CHANGE: /entities rend une page.')).toBe(true)
    expect(casseLExistant('feat(api): pagination\n\nBREAKING-CHANGE: idem, autre ecriture.')).toBe(true)
  })

  it('does not trigger on the word written in passing', () => {
    // The message footer is a LINE that starts with the keyword. Quoting it
    // in an explanation breaks nothing.
    expect(casseLExistant('fix(auth): eviter un BREAKING CHANGE: la session est gardee')).toBe(false)
  })
})

describe('the rule, applied', () => {
  it('a feat pushes the minor and resets the patch to zero', () => {
    expect(versionApres([1, 4, 2], ['feat(version): un numero qui se compare'])).toBe('1.5.0')
  })

  it('everything that is not a feat pushes the patch', () => {
    // `docs:` is not a fix - but a deployed commit that moved no digit would
    // give two releases of the same number.
    expect(versionApres([1, 4, 2], ['fix(web): dix ecrans sans sortie'])).toBe('1.4.3')
    expect(versionApres([1, 4, 2], ['docs(nas): les deux ecritures de la commande'])).toBe('1.4.3')
    expect(versionApres([1, 4, 2], ['un message qui ne suit pas la convention'])).toBe('1.4.3')
  })

  it('a break resets minor AND patch to zero', () => {
    expect(versionApres([1, 4, 2], ['feat!: les tokens de partage changent de forme'])).toBe('2.0.0')
  })

  it('applies a whole batch in order', () => {
    const lot = [
      'fix(web): un debordement en 375 px',
      'feat(version): le numero se deduit des commits',
      'docs: la procedure de deploiement',
      'feat(visite): parcourir sans compte',
    ]
    // 1.4.2 -> 1.4.3 -> 1.5.0 -> 1.5.1 -> 1.6.0
    expect(versionApres([1, 4, 2], lot)).toBe('1.6.0')
  })

  it('with no commit since the tag, the number does not move', () => {
    // Replaying a deployment on the same commit must republish THE SAME
    // version, not invent a new one.
    expect(versionApres([1, 4, 2], [])).toBe('1.4.2')
  })
})

describe('recognizing a feature', () => {
  it('does not confuse feat with what starts the same way', () => {
    expect(apporteUneFonctionnalite('feat: ajouter les tags')).toBe(true)
    expect(apporteUneFonctionnalite('feat(web): ajouter les tags')).toBe(true)
    expect(apporteUneFonctionnalite('feature: ajouter les tags')).toBe(false)
    expect(apporteUneFonctionnalite('fix: retirer les tags')).toBe(false)
  })
})
