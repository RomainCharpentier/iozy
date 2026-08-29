/**
 * <b>L'avatar dit au nom de qui on travaille.</b>
 *
 * <p>Il affichait « IO » en dur — les initiales de l'application, sur le bouton
 * qui mène au compte de quelqu'un. Sur une instance à plusieurs personnes,
 * c'était le seul endroit de l'écran qui aurait pu nommer la collection qu'on
 * regarde, et il nommait le logiciel.
 *
 * <p>Rien de tout cela ne casse bruyamment : l'avatar affiche simplement les
 * mauvaises lettres, sur toutes les pages, sans rien pour le contredire.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { GlobalShortcuts } from './GlobalShortcuts'
import { ApiError } from '../../api/client'

const api = vi.hoisted(() => ({
  lireEtatAuth: vi.fn(),
  lireCompte: vi.fn(),
  seConnecter: vi.fn(),
  creerCompte: vi.fn(),
  seDeconnecter: vi.fn(),
}))
vi.mock('../../api/auth', () => api)

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

/** Rend l'en-tête pour un compte donné, une fois celui-ci connu. */
async function avatarDe(pseudo: string) {
  api.lireCompte.mockResolvedValue({ id: 'u1', email: 'qui@example.com', pseudo })
  render(<GlobalShortcuts />, { wrapper: enrobage })
  return screen.findByRole('link', { name: `Mon profil — ${pseudo}` })
}

describe('l’avatar du menu', () => {
  it('porte les initiales du pseudo connecté', async () => {
    const avatar = await avatarDe('jean-dupont')

    expect(avatar).toHaveTextContent('JD')
  })

  it('nomme la personne pour un lecteur d’écran, pas seulement deux lettres', async () => {
    // « JD » lu à voix haute n'apprend rien : l'intitulé porte le pseudo entier.
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAccessibleName('Mon profil — kenshin')
    expect(avatar).toHaveTextContent('KE')
  })

  it('mène au profil', async () => {
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAttribute('href', '/profile')
  })

  it('retombe sur la marque tant que le compte n’est pas arrivé', async () => {
    // Ce composant vit dans l'AppShell, qui ne se rend que connecté - mais le
    // compte arrive par une requête, et il y a donc un instant sans lui. Deux
    // lettres stables valent mieux qu'un trou qui se remplit.
    api.lireCompte.mockRejectedValue(new ApiError(401, 'Non connecté'))
    render(<GlobalShortcuts />, { wrapper: enrobage })

    await waitFor(() => expect(screen.getByRole('link', { name: 'Mon profil' })).toHaveTextContent('IO'))
  })
})
