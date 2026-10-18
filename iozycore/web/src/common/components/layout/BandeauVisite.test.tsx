/**
 * <b>What a visitor must read permanently.</b>
 *
 * The screens of a visit are exactly those of a personal collection:
 * nothing tells "the catalog" apart by eye from "an empty collection".
 * Someone who arrives three screens later, or who comes back to a tab
 * left open, would have no way of knowing what they are looking at - nor why
 * a detail page refuses to be edited.
 *
 * <p>The exit is no longer here: there is now only a single button to
 * leave, in the header, identical for an account and for a visitor.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { BandeauVisite } from './BandeauVisite'

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

async function rendre(compte: Record<string, unknown>) {
  api.lireCompte.mockResolvedValue(compte)
  render(<BandeauVisite />, { wrapper: enrobage })
  await waitFor(() => expect(api.lireCompte).toHaveBeenCalled())
}

const VISITEUR = { id: null, email: null, pseudo: 'Visiteur', admin: false, invite: true }
const COMPTE = { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: false, invite: false }

describe('during a visit', () => {
  it('says what we are looking at, and that nothing can be edited', async () => {
    await rendre(VISITEUR)

    // Nothing tells "the catalog" apart by eye from "an empty collection":
    // without this sentence, a visitor would think they landed on a broken app.
    expect(await screen.findByText('Mode visiteur')).toBeInTheDocument()
    expect(screen.getByText(/catalogue.*lecture seule/)).toBeInTheDocument()
  })

  it('informs, but does not act: the exit is in the header', async () => {
    // It lived here, then it moved up: there is now only ONE button
    // to leave, in the same place for an account and for a visitor (see
    // BoutonSortie). This banner says what we are looking at, nothing more.
    await rendre(VISITEUR)

    await screen.findByText('Mode visiteur')
    expect(screen.queryByRole('button', { name: 'Quitter' })).not.toBeInTheDocument()
  })
})

describe('with an account', () => {
  it('renders nothing at all', async () => {
    await rendre(COMPTE)

    expect(screen.queryByText(/lecture seule/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitter' })).not.toBeInTheDocument()
  })
})
