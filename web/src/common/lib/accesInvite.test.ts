/**
 * <b>La frontière d'une visite, telle qu'elle est réellement calculée.</b>
 *
 * Cette liste est lue à trois endroits qui ne se parlent pas - le routage, les
 * deux barres de navigation, les raccourcis d'en-tête. Une comparaison
 * approximative s'y verrait mal : un écran de trop resterait proposé à un
 * visiteur (et rebondirait sans un mot), un écran de moins disparaîtrait pour
 * un compte ordinaire, sur des chemins que personne ne pense à rouvrir.
 */
import { describe, expect, it } from 'vitest'
import { estReserveeAuxComptes } from './accesInvite'

describe('ce qu’une visite ne peut pas atteindre', () => {
  it('ferme les écrans dont le sujet est d’écrire', () => {
    expect(estReserveeAuxComptes('/scan')).toBe(true)
    expect(estReserveeAuxComptes('/import-bgg')).toBe(true)
    // Chaque étape d'une analyse est un POST, dont certains sortent chez un
    // fournisseur ou chez un modèle : une porte ouverte à tout Internet n'a
    // pas à offrir ça.
    expect(estReserveeAuxComptes('/purchase-analysis')).toBe(true)
    expect(estReserveeAuxComptes('/purchase-analysis/history')).toBe(true)
  })

  it('ferme l’outillage de l’instance et le compte lui-même', () => {
    expect(estReserveeAuxComptes('/administration')).toBe(true)
    expect(estReserveeAuxComptes('/administration/comptes')).toBe(true)
    expect(estReserveeAuxComptes('/types/new')).toBe(true)
    expect(estReserveeAuxComptes('/profile')).toBe(true)
    expect(estReserveeAuxComptes('/settings')).toBe(true)
  })

  it('laisse ouvert le CATALOGUE, qui est ce qu’un visiteur vient voir', () => {
    // `/add` n'est plus un écran d'ajout : c'est l'entrée du catalogue, et la
    // destination de repli du routage pour un visiteur. Le fermer bouclerait
    // la redirection sur elle-même.
    expect(estReserveeAuxComptes('/add')).toBe(false)
    expect(estReserveeAuxComptes('/entity/abc-123')).toBe(false)
    expect(estReserveeAuxComptes('/collection/manga')).toBe(false)
  })

  it('ferme « Ma collection », qui est un espace PERSONNEL', () => {
    // Elle ne montre que ce qu'on possède ou souhaite : elle serait vide pour
    // un visiteur, et son titre parlerait d'une collection qu'il n'a pas.
    expect(estReserveeAuxComptes('/')).toBe(true)
    // Sans faire de « / » un préfixe qui avalerait tout le reste.
    expect(estReserveeAuxComptes('/add')).toBe(false)
    expect(estReserveeAuxComptes('/entity/abc')).toBe(false)
  })

  it('ferme ce qui se CALCULE sur une collection, et serait donc vide', () => {
    // Une session de visite ne nomme aucun propriétaire : ces écrans seraient
    // exacts et vides - des zéros et des listes sans rien, qui se lisent comme
    // une panne plutôt que comme une réponse.
    expect(estReserveeAuxComptes('/discover')).toBe(true)
    expect(estReserveeAuxComptes('/tier-lists/general/manga')).toBe(true)
    expect(estReserveeAuxComptes('/stats')).toBe(true)
    expect(estReserveeAuxComptes('/recap')).toBe(true)
    expect(estReserveeAuxComptes('/suggestions')).toBe(true)
    expect(estReserveeAuxComptes('/wishlist')).toBe(true)
  })

  it('compare des SEGMENTS, pas des débuts de chaîne', () => {
    // Sans cette nuance, `/types` fermerait un futur `/typesetting` - et
    // l'écran disparaîtrait de la navigation sans que rien ne l'explique.
    expect(estReserveeAuxComptes('/typesetting')).toBe(false)
    expect(estReserveeAuxComptes('/scanner-pro')).toBe(false)
  })
})
