/**
 * <b>Un seul bouton pour sortir, et une seule règle pour le nommer.</b>
 *
 * Il y avait deux boutons — « Se déconnecter » enterré dans les Paramètres,
 * « Quitter » dans le bandeau de visite — pour un seul geste, avec deux mots
 * et deux places. Il n'y en a plus qu'un, dans l'en-tête, et c'est lui qui
 * sait quel mot employer selon qui est là.
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
vi.mock('../api/auth', () => api)

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

describe('le mot employé', () => {
  it('parle de déconnexion pour un compte', async () => {
    await rendre(COMPTE)

    expect(await screen.findByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it('parle de quitter pour un visiteur, qui n’a pas de compte', async () => {
    await rendre(VISITEUR)

    expect(await screen.findByRole('button', { name: 'Quitter' })).toBeInTheDocument()
  })

  it('n’écrit rien à l’écran, mais s’annonce quand même', async () => {
    // Le bouton est une ICÔNE seule, comme sa voisine Administration : un mot
    // aurait pesé plus lourd que les deux boutons réunis. Tout repose donc sur
    // le nom accessible et l'infobulle - sans eux, ce serait une sortie
    // réservée à qui devine.
    await rendre(COMPTE)

    const bouton = await screen.findByRole('button', { name: 'Se déconnecter' })
    expect(bouton).toHaveAttribute('title', 'Se déconnecter')
    expect(bouton).toHaveTextContent('')
  })
})

describe('le geste', () => {
  it('ferme la session', async () => {
    await rendre(COMPTE)

    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => expect(api.seDeconnecter).toHaveBeenCalled())
  })
})
