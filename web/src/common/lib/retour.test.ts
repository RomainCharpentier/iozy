/**
 * <b>D'où l'on vient — et ce qu'on refuse de croire sur parole.</b>
 *
 * <p>Six écrans lisent cette origine pour afficher leur lien de retour. Elle
 * voyage dans `location.state`, c'est-à-dire un sac libre : une version
 * antérieure de l'application a pu le remplir autrement, et un lien forgé peut
 * y mettre n'importe quoi. Deux règles en découlent, et aucune ne se voit
 * quand elle tombe :
 * <ul>
 *   <li>un état qui n'a pas la bonne forme ne donne <b>pas</b> de retour — le
 *       lien disparaît, l'écran reste entier ;</li>
 *   <li>la destination est une route <b>interne</b>. Sans ce refus, un état
 *       forgé transformerait le bouton « Retour » en redirection vers
 *       l'extérieur.</li>
 * </ul>
 */
import { describe, expect, it } from 'vitest'
import { retourDepuis } from './retour'

describe('retourDepuis', () => {
  it('rend l’origine quand elle est complète', () => {
    expect(retourDepuis({ retour: { to: '/add', libelle: 'Recherche' } }))
      .toEqual({ to: '/add', libelle: 'Recherche' })
  })

  it('ne rend rien quand il n’y a pas d’origine', () => {
    // Le cas NORMAL : page rechargée, lien reçu, arrivée directe. L'écran
    // affiche alors son parent naturel, il ne se casse pas.
    expect(retourDepuis(null)).toBeNull()
    expect(retourDepuis(undefined)).toBeNull()
    expect(retourDepuis({})).toBeNull()
    expect(retourDepuis('/add')).toBeNull()
  })

  it('refuse une origine à moitié écrite', () => {
    expect(retourDepuis({ retour: { to: '/add' } })).toBeNull()
    expect(retourDepuis({ retour: { libelle: 'Recherche' } })).toBeNull()
    expect(retourDepuis({ retour: { to: 42, libelle: 'Recherche' } })).toBeNull()
  })

  it('refuse tout ce qui sortirait de l’application', () => {
    // Un « Retour » qui emmène ailleurs qu'ici serait exactement le contraire
    // de ce qu'il annonce.
    expect(retourDepuis({ retour: { to: 'https://example.com', libelle: 'Ailleurs' } })).toBeNull()
    expect(retourDepuis({ retour: { to: '//example.com', libelle: 'Ailleurs' } })).toBeNull()
    expect(retourDepuis({ retour: { to: 'javascript:alert(1)', libelle: 'Ailleurs' } })).toBeNull()
  })
})
