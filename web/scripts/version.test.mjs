/**
 * <b>Le numéro de version se déduit des commits — et c'est là que ça se casse.</b>
 *
 * Aucun écran ne montrerait l'erreur : une majeure oubliée, un `docs:` qui
 * n'incrémente rien, et deux livraisons différentes portent le même numéro
 * sans que personne ne le voie avant d'en avoir besoin.
 */
import { describe, expect, it } from 'vitest'
import { apporteUneFonctionnalite, casseLExistant, lireEtiquette, versionApres } from './version.mjs'

describe('lire l’étiquette de départ', () => {
  it('accepte la forme vX.Y.Z, et rien d’autre', () => {
    expect(lireEtiquette('v1.4.2')).toEqual([1, 4, 2])
    expect(lireEtiquette('  v10.0.7\n')).toEqual([10, 0, 7])
    // `version-379` est l'étiquette de la première tentative de numérotage :
    // elle vit encore dans le dépôt et ne doit jamais servir de départ.
    expect(lireEtiquette('version-379')).toBeNull()
    expect(lireEtiquette('v1.4')).toBeNull()
  })
})

describe('ce qui casse l’existant', () => {
  it('se reconnaît au point d’exclamation', () => {
    expect(casseLExistant('feat!: la session ne survit plus au redemarrage')).toBe(true)
    expect(casseLExistant('refactor(api)!: /entities rend une page, plus une liste')).toBe(true)
  })

  it('se reconnaît aussi au pied de message', () => {
    expect(casseLExistant('feat(api): pagination\n\nBREAKING CHANGE: /entities rend une page.')).toBe(true)
    expect(casseLExistant('feat(api): pagination\n\nBREAKING-CHANGE: idem, autre ecriture.')).toBe(true)
  })

  it('ne se déclenche pas sur le mot écrit en passant', () => {
    // Le pied de message est une LIGNE qui commence par le mot-clé. Le citer
    // dans une explication ne casse rien.
    expect(casseLExistant('fix(auth): eviter un BREAKING CHANGE: la session est gardee')).toBe(false)
  })
})

describe('la règle, appliquée', () => {
  it('un feat pousse la mineure et remet le patch à zéro', () => {
    expect(versionApres([1, 4, 2], ['feat(version): un numero qui se compare'])).toBe('1.5.0')
  })

  it('tout ce qui n’est pas un feat pousse le patch', () => {
    // `docs:` n'est pas un correctif - mais un commit déployé qui ne bougerait
    // aucun chiffre donnerait deux livraisons du même numéro.
    expect(versionApres([1, 4, 2], ['fix(web): dix ecrans sans sortie'])).toBe('1.4.3')
    expect(versionApres([1, 4, 2], ['docs(nas): les deux ecritures de la commande'])).toBe('1.4.3')
    expect(versionApres([1, 4, 2], ['un message qui ne suit pas la convention'])).toBe('1.4.3')
  })

  it('une rupture remet mineure ET patch à zéro', () => {
    expect(versionApres([1, 4, 2], ['feat!: les tokens de partage changent de forme'])).toBe('2.0.0')
  })

  it('applique un lot entier dans l’ordre', () => {
    const lot = [
      'fix(web): un debordement en 375 px',
      'feat(version): le numero se deduit des commits',
      'docs: la procedure de deploiement',
      'feat(visite): parcourir sans compte',
    ]
    // 1.4.2 -> 1.4.3 -> 1.5.0 -> 1.5.1 -> 1.6.0
    expect(versionApres([1, 4, 2], lot)).toBe('1.6.0')
  })

  it('sans commit depuis l’étiquette, le numéro ne bouge pas', () => {
    // Rejouer un déploiement sur le même commit doit republier LA MÊME
    // version, pas en inventer une nouvelle.
    expect(versionApres([1, 4, 2], [])).toBe('1.4.2')
  })
})

describe('reconnaître une fonctionnalité', () => {
  it('ne confond pas feat avec ce qui commence pareil', () => {
    expect(apporteUneFonctionnalite('feat: ajouter les tags')).toBe(true)
    expect(apporteUneFonctionnalite('feat(web): ajouter les tags')).toBe(true)
    expect(apporteUneFonctionnalite('feature: ajouter les tags')).toBe(false)
    expect(apporteUneFonctionnalite('fix: retirer les tags')).toBe(false)
  })
})
