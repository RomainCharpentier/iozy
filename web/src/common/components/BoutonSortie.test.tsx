/**
 * <b>A single button to leave, and a single rule to name it.</b>
 *
 * There were two buttons - "Se déconnecter" buried in the Settings,
 * "Quitter" in the visit banner - for a single action, with two words
 * and two places. There is now only one, in the header, and it is the one that
 * knows which word to use depending on who is there.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { BoutonSortie } from './BoutonSortie'

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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  api.lireEtatAuth.mockResolvedValue({ aucunCompte: false, creationOuverte: false })
})

const COMPTE = { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: false, invite: false }
const VISITEUR = { id: null, email: null, pseudo: 'Visiteur', admin: false, invite: true }

async function rendre(compte: Record<string, unknown>) {
  api.lireCompte.mockResolvedValue(compte)
  render(<BoutonSortie />, { wrapper: enrobage })
  await waitFor(() => expect(api.lireCompte).toHaveBeenCalled())
}

describe('the word used', () => {
  it('talks about signing out for an account', async () => {
    await rendre(COMPTE)

    expect(await screen.findByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('talks about leaving for a visitor, who has no account', async () => {
    await rendre(VISITEUR)

    expect(await screen.findByRole('button', { name: 'Quitter' })).toBeInTheDocument()
  })

  it('writes nothing on screen, but still announces itself', async () => {
    // The button is an icon ONLY, like its neighbor Administration: a word
    // would have weighed more than the two buttons together. Everything rests on
    // the accessible name and the tooltip - without them, it would be an exit
    // reserved for those who guess.
    await rendre(COMPTE)

    const bouton = await screen.findByRole('button', { name: 'Se déconnecter' })
    expect(bouton).toHaveAttribute('title', 'Se déconnecter')
    expect(bouton).toHaveTextContent('')
  })
})

describe('the action', () => {
  it('closes the session', async () => {
    await rendre(COMPTE)

    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => expect(api.seDeconnecter).toHaveBeenCalled())
  })
})
