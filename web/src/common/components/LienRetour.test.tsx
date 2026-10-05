/**
 * <b>The exit of a screen that was necessarily opened from elsewhere.</b>
 *
 * <p>Ten screens had none. They are all reachable from somewhere
 * and from nowhere else - "Comptes" from Administration,
 * "Bilan annuel" from Discover - and the only exit was the browser's
 * Back button, which does not exist in an app installed in full
 * screen (the manifest declares {@code display: standalone}).
 *
 * <p>Two rules, and each one breaks silently: the link shows the wrong
 * destination, or it leads somewhere other than where it promises.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LienRetour } from './LienRetour'

const PARENT = { to: '/administration', libelle: 'Administration' }

/** Renders the link on a route, with the state that a caller would have set. */
function ecran(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/administration/comptes', state }]}>
      <Routes>
        <Route path="/administration/comptes" element={<LienRetour parDefaut={PARENT} />} />
        <Route path="*" element={<Ou />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Says where we landed - this is what the link PROMISES that we check. */
function Ou() {
  return <p>arrivé sur {useLocation().pathname}</p>
}

describe('without a named origin', () => {
  it('offers the natural parent, and really leads there', async () => {
    ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Administration' }))

    expect(screen.getByText('arrivé sur /administration')).toBeInTheDocument()
  })

  it('also applies to a state that does not have the right shape', () => {
    // `location.state` is a free bag: a forged link or an earlier
    // version of the app can fill it differently. The page stays whole.
    ecran({ retour: 'Ma collection' })

    expect(screen.getByRole('button', { name: 'Administration' })).toBeInTheDocument()
  })
})

describe('with a named origin', () => {
  it('offers this one rather than the parent', async () => {
    // The collection categories are also opened from Ma collection ▸ Plus
    // d'outils: going back through Administration would be a detour that nobody
    // asked for.
    ecran({ retour: { to: '/', libelle: 'Ma collection' } })

    await userEvent.click(screen.getByRole('button', { name: 'Ma collection' }))

    expect(screen.getByText('arrivé sur /')).toBeInTheDocument()
  })

  it('refuses a destination that would leave the application', () => {
    // This link must not be able to become a redirect to the outside.
    ecran({ retour: { to: '//exemple.test', libelle: 'Ailleurs' } })

    expect(screen.getByRole('button', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ailleurs' })).not.toBeInTheDocument()
  })
})

describe('the label', () => {
  it('names the destination, never "Retour" alone', () => {
    // A "Retour" without a destination lies one time in two - this is what
    // navigate(-1) would do, which goes back to the previous screen and not to the one that
    // contains.
    ecran()

    const lien = screen.getByRole('button', { name: 'Administration' })
    expect(lien).not.toHaveTextContent(/^Retour$/)
  })
})
