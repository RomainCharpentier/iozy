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
    expect(estReserveeAuxComptes('/add')).toBe(true)
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

  it('laisse ouvert tout ce qui ne fait que MONTRER la collection', () => {
    // C'est exactement ce qu'un visiteur est venu voir. L'accueil en premier :
    // c'est aussi la destination de repli du routage, et le fermer bouclerait
    // la redirection sur elle-même.
    expect(estReserveeAuxComptes('/')).toBe(false)
    expect(estReserveeAuxComptes('/entity/abc-123')).toBe(false)
    expect(estReserveeAuxComptes('/collection/manga')).toBe(false)
    expect(estReserveeAuxComptes('/discover')).toBe(false)
    expect(estReserveeAuxComptes('/tier-lists/general/manga')).toBe(false)
    expect(estReserveeAuxComptes('/stats')).toBe(false)
    expect(estReserveeAuxComptes('/recap')).toBe(false)
    expect(estReserveeAuxComptes('/suggestions')).toBe(false)
  })

  it('compare des SEGMENTS, pas des débuts de chaîne', () => {
    // Sans cette nuance, `/types` fermerait un futur `/typesetting` - et
    // l'écran disparaîtrait de la navigation sans que rien ne l'explique.
    expect(estReserveeAuxComptes('/typesetting')).toBe(false)
    expect(estReserveeAuxComptes('/addendum')).toBe(false)
  })
})
