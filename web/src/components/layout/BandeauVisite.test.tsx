/**
 * <b>Ce qu'un visiteur doit lire en permanence.</b>
 *
 * Les écrans d'une visite sont exactement ceux d'une collection personnelle :
 * rien d'autre ne distingue « ma collection » de « la sienne ». Quelqu'un qui
 * arrive trois écrans plus loin, ou qui revient sur un onglet laissé ouvert,
 * n'aurait aucun moyen de savoir ce qu'il regarde - ni pourquoi une fiche
 * refuse de se modifier.
 *
 * <p>Et la sortie est ici, faute d'exister ailleurs : un visiteur n'a ni
 * profil ni réglages où aller la chercher (voir lib/accesInvite).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
vi.mock('../../api/auth', () => api)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  api.lireEtatAuth.mockResolvedValue({ aucunCompte: false, creationOuverte: false, visiteOuverte: true })
})

async function rendre(compte: Record<string, unknown>) {
  api.lireCompte.mockResolvedValue(compte)
  render(<BandeauVisite />, { wrapper: enrobage })
  await waitFor(() => expect(api.lireCompte).toHaveBeenCalled())
}

const VISITEUR = { id: 'proprio-1', email: null, pseudo: 'kenshin', admin: false, invite: true }
const COMPTE = { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: false, invite: false }

describe('pendant une visite', () => {
  it('dit chez qui l’on est, et que rien ne se modifie', async () => {
    await rendre(VISITEUR)

    expect(await screen.findByText('kenshin')).toBeInTheDocument()
    expect(screen.getByText(/lecture seule/)).toBeInTheDocument()
  })

  it('offre la sortie, qui n’existe nulle part ailleurs pour un visiteur', async () => {
    await rendre(VISITEUR)

    await userEvent.click(await screen.findByRole('button', { name: 'Quitter' }))

    await waitFor(() => expect(api.seDeconnecter).toHaveBeenCalled())
  })
})

describe('avec un compte', () => {
  it('ne rend rien du tout', async () => {
    await rendre(COMPTE)

    expect(screen.queryByText(/lecture seule/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quitter' })).not.toBeInTheDocument()
  })
})
