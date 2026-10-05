/**
 * <b>The two header buttons: administration, and the profile.</b>
 *
 * <p>This is the only access, from any screen, to what belongs to
 * none of the four daily intentions. And there are <b>two</b> buttons,
 * not one: administration took three tries to find its place - under
 * Settings, then as a link on Profile, then in a dropdown menu of the avatar
 * - three times put away behind something that belongs to the user.
 * Declaring the categories of one's collection is not a personal setting, and
 * is not found by looking for one's profile.
 *
 * <p>Two <b>links</b>, and no menu: a panel to open then close again
 * for a choice between two entries costs more than it tidies.
 *
 * <p>Nothing here breaks loudly. The avatar shows the wrong letters, a
 * button changes target: the application keeps working, a screen
 * simply becomes unreachable other than by typing its URL.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { GlobalShortcuts } from './GlobalShortcuts'
import { ApiError } from '@/common/api/client'

const api = vi.hoisted(() => ({
  lireEtatAuth: vi.fn(),
  lireCompte: vi.fn(),
  seConnecter: vi.fn(),
  creerCompte: vi.fn(),
  seDeconnecter: vi.fn(),
  entrerEnVisite: vi.fn(),
}))
vi.mock('@/common/api/auth', () => api)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.lireEtatAuth.mockResolvedValue({ aucunCompte: false, creationOuverte: false })
})

/** Renders the header for a given account, once it is known. */
async function avatarDe(pseudo: string) {
  api.lireCompte.mockResolvedValue({ id: 'u1', email: 'qui@example.com', pseudo, admin: false, invite: false })
  render(<GlobalShortcuts />, { wrapper: enrobage })
  return screen.findByRole('link', { name: `Mon profil — ${pseudo}` })
}

describe('the avatar', () => {
  it('carries the initials of the signed-in pseudo', async () => {
    const avatar = await avatarDe('jean-dupont')

    expect(avatar).toHaveTextContent('JD')
  })

  it('names the person for a screen reader, not just two letters', async () => {
    // "KE" read aloud tells nothing: the label carries the whole pseudo.
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAccessibleName('Mon profil — kenshin')
    expect(avatar).toHaveTextContent('KE')
  })

  it('leads straight to the profile, with no panel to open', async () => {
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAttribute('href', '/profile')
    expect(avatar).not.toHaveAttribute('aria-haspopup')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('falls back on the brand as long as the account has not arrived', async () => {
    // This component lives in the AppShell, which only renders when signed in - but the
    // account arrives through a request, so there is a moment without it. Two
    // stable letters are better than a hole that fills in.
    api.lireCompte.mockRejectedValue(new ApiError(401, 'Non connecté'))
    render(<GlobalShortcuts />, { wrapper: enrobage })

    await waitFor(() => expect(screen.getByRole('link', { name: 'Mon profil' })).toHaveTextContent('IO'))
  })
})

describe('the Administration button', () => {
  it('is a direct access, next to the avatar and not inside it', async () => {
    await avatarDe('kenshin')

    const administration = screen.getByRole('link', { name: 'Administration' })
    expect(administration).toHaveAttribute('href', '/administration')
    // An icon only: the header stays calm, and the name is carried by
    // aria-label - a title alone names nothing with a finger.
    expect(administration).toHaveAccessibleName('Administration')
  })

  it('is not put away behind the profile', async () => {
    // Three times in a row, it was. This test is here for the fourth.
    await avatarDe('kenshin')

    const acces = screen.getAllByRole('link')
    expect(acces).toHaveLength(2)
    expect(acces.map((a) => a.getAttribute('href'))).toEqual(['/administration', '/profile'])
  })
})

/**
 * <b>During a visit, these two buttons talk about nobody.</b>
 *
 * They both designate "one's own home" - one's profile, one's instance - and a
 * visitor has neither. The avatar is the worse of the two: it would have
 * carried the initials and the color of the HOST, meaning that the only
 * place in the application that says "this is you" would have shown the name of
 * someone else.
 */
describe('during a visit without an account', () => {
  async function enVisite() {
    api.lireCompte.mockResolvedValue({
      id: null,
      email: null,
      pseudo: 'Visiteur',
      admin: false,
      invite: true,
    })
    render(<GlobalShortcuts />, { wrapper: enrobage })
    await waitFor(() => expect(api.lireCompte).toHaveBeenCalled())
  }

  // `waitFor` on the DISAPPEARANCE, and not a dry assertion: the component
  // first renders its fallback ("IO", while the account arrives), and
  // noting its absence at that moment would have been green without proving anything.
  it('does not show the avatar of its host as if it were its own', async () => {
    await enVisite()

    await waitFor(() => expect(screen.queryByRole('link', { name: /Mon profil/ })).not.toBeInTheDocument())
  })

  it('does not show the administration of the instance', async () => {
    await enVisite()

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument())
  })

  it('keeps the theme: a setting of the device, not of the account', async () => {
    await enVisite()

    expect(await screen.findByRole('button', { name: /Passer en thème/ })).toBeInTheDocument()
  })
})

describe('the theme', () => {
  it('is changed in one click from the header, without going through the Settings', async () => {
    // It lived there, three clicks from any screen (batch 138).
    await avatarDe('romain')

    expect(screen.getByRole('button', { name: /Passer en thème/ })).toBeInTheDocument()
  })
})
