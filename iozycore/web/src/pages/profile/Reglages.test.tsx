/**
 * <b>"Mon compte" and "Cet appareil" are not the same thing, and the
 * section must say so.</b>
 *
 * <p>It is the only place in the application that mixes two kinds of
 * settings: what lives on the server and follows you everywhere, and what lives in
 * the `localStorage` of THIS browser and is lost when changing machine. Nothing
 * tells the two apart by eye - a switch looks like a switch.
 * A "Paramètres" screen until batch 140, a section of Profil since.
 *
 * <p>Two silent defects, then: the sentence that warns disappears (and
 * someone believes a setting was lost when opening the app on their phone),
 * or the export gets lost again in the administration (and taking one's data away
 * becomes a matter of technical configuration again).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { Reglages } from './Reglages'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const deconnexion = { mutate: vi.fn(), isPending: false }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  auth.useAuth.mockReturnValue({
    compte: { id: 'u1', email: 'romain@iozycore.local', pseudo: 'romain', admin: true },
    deconnexion,
  })
  render(<Reglages />, { wrapper: enrobage })
})

describe('"Mon compte"', () => {
  it('says who you are', () => {
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).getByText('romain')).toBeInTheDocument()
    expect(within(monCompte).getByText('romain@iozycore.local')).toBeInTheDocument()
  })

  it('no longer carries the sign-out, which moved up to the header', () => {
    // It lived here, three clicks from the avatar (Profil, then Paramètres,
    // then this section): impossible to find for whoever does not know the path. There
    // is now only ONE exit button, in the header, the same for an
    // account and for a visitor (see BoutonSortie).
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).queryByRole('button', { name: /déconnecter/i })).not.toBeInTheDocument()
  })

  it('carries the export, which belongs to the account and not to the administration', () => {
    // Taking one's collection away is the guarantee of being able to leave, not of
    // technical configuration: it is the account that owns this data.
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).getByRole('link', { name: 'Télécharger en JSON' })).toHaveAttribute(
      'href',
      '/api/export/json',
    )
    expect(within(monCompte).getByRole('link', { name: /Télécharger en CSV/ })).toHaveAttribute(
      'href',
      '/api/export/csv',
    )
  })
})

describe('"Cet appareil"', () => {
  it('warns that this setting does not follow the account', () => {
    // The language of the titles lives in the localStorage of this browser. Without
    // this sentence, nobody can guess it.
    expect(screen.getByText(/reste sur cet appareil/)).toBeInTheDocument()
    expect(screen.getByText(/ne suit pas ton compte/)).toBeInTheDocument()
  })

  it('keeps the language of the titles, and says where the theme went', () => {
    // The theme switch lived here until batch 138. It is in
    // the header, one click on the sun or the moon - and this screen says so,
    // for whoever comes looking for it where they knew it.
    expect(screen.queryByRole('switch', { name: 'Thème sombre' })).not.toBeInTheDocument()
    expect(screen.getByText(/soleil ou la lune/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Titre des mangas' })).toBeInTheDocument()
  })
})

describe('the administration', () => {
  it('is no longer a sub-part of the settings', () => {
    // It lived here until 2026-08-29, at the bottom of the page. Setting one's theme and
    // declaring the categories of one's collection have nothing in common: they are two
    // SIBLING screens, both reached from Profil. Nested, it put
    // the reference editions at three levels of depth.
    expect(screen.queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })

  it('does not take the settings of this device with it', () => {
    // The move must empty neither of the two sections.
    expect(screen.getByRole('region', { name: 'Mon compte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Titre des mangas' })).toBeInTheDocument()
  })
})

describe('the order of the title languages', () => {
  it('is changed with the arrows, not only with the mouse', () => {
    // HTML drag and drop does not exist with a finger: on a phone, the order
    // was impossible to change (batch 148). The arrows work everywhere.
    const ordre = () => screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(ordre()[0]).toContain('Français')
    expect(screen.getByRole('button', { name: 'Monter Français' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Descendre Français' }))

    expect(ordre()[0]).toContain('Romaji')
    expect(ordre()[1]).toContain('Français')

    fireEvent.click(screen.getByRole('button', { name: 'Monter Français' }))

    expect(ordre()[0]).toContain('Français')
  })
})
