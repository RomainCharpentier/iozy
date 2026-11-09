/**
 * <b>The common profile: the person first, one panel, nothing borrowed.</b>
 *
 * <p>Lot 218 makes this screen the profile of both apps: the pseudo, very
 * large, then one panel of settings that follow the account. It is still not
 * a <b>corridor</b>: no "Paramètres" link, no listing analysis, no yearly
 * review. The administration of the instance comes back only as a discreet
 * link, and only for the account that can use it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ProfilePage } from './ProfilePage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)
vi.mock('@/common/api/home', () => ({ fetchHomeWeek: vi.fn(() => new Promise(() => {})) }))

// Three live sections of this screen, each with its own queries:
// this test is about what the profile carries, not about what they display.
vi.mock('./ProfileValueHero', () => ({ ProfileValueHero: () => null }))
vi.mock('./ProfileTierListsSection', () => ({ ProfileTierListsSection: () => null }))
vi.mock('./ShareSection', () => ({ ShareSection: () => null }))

function enrobage({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function afficher(admin: boolean) {
  auth.useAuth.mockReturnValue({
    compte: { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin, invite: false, preferences: null },
  })
  render(<ProfilePage />, { wrapper: enrobage })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('the identity', () => {
  it('names the person in large, and says the profile is the same for IozyTest', () => {
    afficher(false)

    expect(screen.getByRole('heading', { level: 1, name: 'romain' })).toBeInTheDocument()
    expect(screen.getByText('Un seul profil pour ta collection et pour IozyTest')).toBeInTheDocument()
    // The address signs in; it is read in the panel, never as a name.
    expect(screen.getByText('moi@example.com')).toBeInTheDocument()
  })
})

describe('the settings, on the page itself', () => {
  it('are one panel, without a Paramètres link', () => {
    afficher(false)

    expect(screen.getByRole('region', { name: 'Mon compte' })).toBeInTheDocument()
    for (const ligne of ['Pseudo', 'Couleur', 'Apparence', 'Titres des mangas', 'Son du blindtest', 'Mes données']) {
      expect(screen.getByRole('heading', { name: ligne })).toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: /Paramètres/ })).not.toBeInTheDocument()
  })
})

describe('what the profile does not duplicate', () => {
  it('leads neither to the listing analysis, nor to the yearly review, nor to "Demander à ma collection"', () => {
    afficher(true)

    expect(screen.queryByRole('link', { name: /Analyser une annonce/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Bilan annuel/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Demander à ma collection/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Se déconnecter/ })).not.toBeInTheDocument()
  })
})

describe('the administration of the instance', () => {
  it('is a discreet link for an administrator', () => {
    afficher(true)

    expect(screen.getByRole('link', { name: 'Administration de l’instance' })).toHaveAttribute(
      'href',
      '/administration',
    )
  })

  it('is not offered to an account that cannot use it', () => {
    afficher(false)

    expect(screen.queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })
})
