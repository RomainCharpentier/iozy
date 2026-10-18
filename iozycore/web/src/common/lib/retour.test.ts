/**
 * <b>Where we come from — and what we refuse to take on trust.</b>
 *
 * <p>Six screens read this origin to display their back link. It travels in
 * `location.state`, that is a free bag: an earlier version of the application
 * may have filled it differently, and a forged link can put anything in it.
 * Two rules follow from it, and neither can be seen when it fails:
 * <ul>
 *   <li>a state that does not have the right shape gives <b>no</b> back link
 *       — the link disappears, the screen stays whole;</li>
 *   <li>the destination is an <b>internal</b> route. Without this refusal, a
 *       forged state would turn the "Retour" button into a redirect to the
 *       outside.</li>
 * </ul>
 */
import { describe, expect, it } from 'vitest'
import { retourDepuis } from './retour'

describe('retourDepuis', () => {
  it('returns the origin when it is complete', () => {
    expect(retourDepuis({ retour: { to: '/add', libelle: 'Recherche' } }))
      .toEqual({ to: '/add', libelle: 'Recherche' })
  })

  it('returns nothing when there is no origin', () => {
    // The NORMAL case: page reloaded, received link, direct arrival. The
    // screen then shows its natural parent, it does not break.
    expect(retourDepuis(null)).toBeNull()
    expect(retourDepuis(undefined)).toBeNull()
    expect(retourDepuis({})).toBeNull()
    expect(retourDepuis('/add')).toBeNull()
  })

  it('refuses a half-written origin', () => {
    expect(retourDepuis({ retour: { to: '/add' } })).toBeNull()
    expect(retourDepuis({ retour: { libelle: 'Recherche' } })).toBeNull()
    expect(retourDepuis({ retour: { to: 42, libelle: 'Recherche' } })).toBeNull()
  })

  it('refuses everything that would leave the application', () => {
    // A "Retour" that takes you somewhere other than here would be exactly
    // the opposite of what it announces.
    expect(retourDepuis({ retour: { to: 'https://example.com', libelle: 'Ailleurs' } })).toBeNull()
    expect(retourDepuis({ retour: { to: '//example.com', libelle: 'Ailleurs' } })).toBeNull()
    expect(retourDepuis({ retour: { to: 'javascript:alert(1)', libelle: 'Ailleurs' } })).toBeNull()
  })
})
