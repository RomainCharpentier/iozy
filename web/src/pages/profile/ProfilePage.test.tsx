/**
 * <b>What Profil is no longer.</b>
 *
 * <p>This screen long served as a list of shortcuts: it carried "Analyser
 * une annonce" (already one of the four destinations of the navigation bar),
 * "Bilan annuel" (a reading, not a setting), the Compte section (of which the
 * sign-out and the export lived elsewhere), then the links to Paramètres and
 * Administration. Each one made the screen a little less readable, without ever
 * breaking anything.
 *
 * <p>It is no longer a <b>corridor</b>: the administration has its own button
 * in the header (see GlobalShortcuts), and the settings are ON this screen
 * (batch 140) - no longer behind a "Paramètres" link. The rest concerns THIS
 * collection: its value, its rankings, its sharing.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ProfilePage } from './ProfilePage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

// Three live sections of this screen, each with its own queries:
// this test is about the NAVIGATION, not about what they display.
vi.mock('./ProfileValueHero', () => ({ ProfileValueHero: () => null }))
vi.mock('./ProfileTierListsSection', () => ({ ProfileTierListsSection: () => null }))
vi.mock('./ShareSection', () => ({ ShareSection: () => null }))

function enrobage({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.useAuth.mockReturnValue({ compte: { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: true } })
  render(<ProfilePage />, { wrapper: enrobage })
})

describe('the settings, on the page itself', () => {
  it('carries "Mon compte" and "Cet appareil" in the open, without a Paramètres link', () => {
    // "No sub-menu, it must be readable directly" (batch 140): what
    // speaks of the same person does not open a second screen.
    expect(screen.getByRole('region', { name: 'Mon compte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cet appareil' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Paramètres/ })).not.toBeInTheDocument()
  })

  it('no longer offers "Demander à ma collection"', () => {
    // Batch 117, removed in batch 140: "ne sert à rien".
    expect(screen.queryByRole('link', { name: /Demander à ma collection/ })).not.toBeInTheDocument()
  })
})

describe('what Profil does not duplicate', () => {

  it('does not put the administration back behind the profile', () => {
    // It was already stored there, as under Paramètres and in a menu of
    // the avatar. It now has its button in the header, and putting it back
    // here would be the fourth time.
    expect(screen.queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })

  it('does not lead to the analysis of a listing, which has its doors elsewhere', () => {
    // It was one of the four global tabs; since batch 137 it is reached
    // from Découvrir and from the detail page of a series. The profile
    // has no more reason to duplicate it than before.
    expect(screen.queryByRole('link', { name: /Analyser une annonce/ })).not.toBeInTheDocument()
  })

  it('no longer carries the yearly review, which is a reading', () => {
    expect(screen.queryByRole('link', { name: /Bilan annuel/ })).not.toBeInTheDocument()
  })
})

describe('the identity', () => {
  it('says whose profile it is, and the account reads below', () => {
    // The username as subtitle: a screen called "Mon profil" must
    // name the person. It says it again in "Mon compte", with the address -
    // on this page since batch 140. The sign-out, for its part, stays in
    // the header: the same button on all the screens.
    expect(screen.getAllByText('romain')).toHaveLength(2)
    expect(screen.getByText('moi@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Se déconnecter/ })).not.toBeInTheDocument()
  })
})
