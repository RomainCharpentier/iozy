/**
 * <b>Ce qu'un visiteur doit lire en permanence.</b>
 *
 * Les écrans d'une visite sont exactement ceux d'une collection personnelle :
 * rien ne distingue à l'œil « le catalogue » d'« une collection vide ».
 * Quelqu'un qui arrive trois écrans plus loin, ou qui revient sur un onglet
 * laissé ouvert, n'aurait aucun moyen de savoir ce qu'il regarde - ni pourquoi
 * une fiche refuse de se modifier.
 *
 * <p>La sortie, elle, n'est plus ici : il n'y a plus qu'un seul bouton pour
 * sortir, dans l'en-tête, identique pour un compte et pour un visiteur.
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

describe('pendant une visite', () => {
  it('dit ce qu’on regarde, et que rien ne se modifie', async () => {
    await rendre(VISITEUR)

    // Rien ne distingue à l'œil « le catalogue » d'« une collection vide » :
    // sans cette phrase, un visiteur croirait tomber sur une app en panne.
    expect(await screen.findByText('Mode visiteur')).toBeInTheDocument()
    expect(screen.getByText(/catalogue.*lecture seule/)).toBeInTheDocument()
  })

  it('informe, mais n’agit pas : la sortie est dans l’en-tête', async () => {
    // Elle a vécu ici, puis elle est remontée : il n'y a plus qu'UN bouton
    // pour sortir, au même endroit pour un compte et pour un visiteur (voir
    // BoutonSortie). Ce bandeau dit ce qu'on regarde, rien de plus.
    await rendre(VISITEUR)

    await screen.findByText('Mode visiteur')
    expect(screen.queryByRole('button', { name: 'Quitter' })).not.toBeInTheDocument()
  })
})

describe('avec un compte', () => {
  it('ne rend rien du tout', async () => {
    await rendre(COMPTE)

    expect(screen.queryByText(/lecture seule/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitter' })).not.toBeInTheDocument()
  })
})
