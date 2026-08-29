/**
 * <b>Le bouton « RO », et le menu qu'il ouvre.</b>
 *
 * <p>C'est le seul accès, depuis n'importe quel écran, à ce qui n'appartient à
 * aucune des quatre intentions quotidiennes : son profil, ses réglages,
 * l'administration. Trois écrans <b>sœurs</b> - et c'est la règle qui vient
 * d'être posée : l'administration a vécu sous les réglages de l'utilisateur,
 * puis sous Profil, et dans les deux cas configurer sa machine se trouvait en
 * cherchant autre chose.
 *
 * <p>Rien ici ne casse bruyamment. L'avatar affiche les mauvaises lettres, ou
 * le menu perd une entrée : l'application continue de fonctionner, un écran
 * devient simplement introuvable autrement qu'en tapant son URL.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  api.lireCompte.mockResolvedValue({ id: 'u1', email: 'qui@example.com', pseudo, admin: false })
  render(<GlobalShortcuts />, { wrapper: enrobage })
  return screen.findByRole('button', { name: `Mon compte — ${pseudo}` })
}

/** Ouvre le menu, comme on le fait à la souris ou au doigt. */
async function menuDe(pseudo: string) {
  await userEvent.click(await avatarDe(pseudo))
  return screen.getByRole('dialog')
}

describe('l’avatar', () => {
  it('porte les initiales du pseudo connecté', async () => {
    const avatar = await avatarDe('jean-dupont')

    expect(avatar).toHaveTextContent('JD')
  })

  it('nomme la personne pour un lecteur d’écran, pas seulement deux lettres', async () => {
    // « KE » lu à voix haute n'apprend rien : l'intitulé porte le pseudo entier.
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAccessibleName('Mon compte — kenshin')
    expect(avatar).toHaveTextContent('KE')
  })

  it('annonce qu’il ouvre un panneau, et son état', async () => {
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAttribute('aria-haspopup', 'dialog')
    expect(avatar).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(avatar)
    expect(avatar).toHaveAttribute('aria-expanded', 'true')
  })

  it('retombe sur la marque tant que le compte n’est pas arrivé', async () => {
    // Ce composant vit dans l'AppShell, qui ne se rend que connecté - mais le
    // compte arrive par une requête, et il y a donc un instant sans lui. Deux
    // lettres stables valent mieux qu'un trou qui se remplit.
    api.lireCompte.mockRejectedValue(new ApiError(401, 'Non connecté'))
    render(<GlobalShortcuts />, { wrapper: enrobage })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Mon compte' })).toHaveTextContent('IO'))
  })
})

describe('le menu', () => {
  it('mène aux trois écrans, à égale distance', async () => {
    const menu = await menuDe('kenshin')

    expect(within(menu).getByRole('link', { name: /Mon profil/ })).toHaveAttribute('href', '/profile')
    expect(within(menu).getByRole('link', { name: /Paramètres/ })).toHaveAttribute('href', '/settings')
    // La raison d'être de ce menu : l'administration n'est PAS sous les
    // réglages de l'utilisateur, ni sous Profil. Elle est leur sœur.
    expect(within(menu).getByRole('link', { name: /Administration/ })).toHaveAttribute('href', '/administration')
    expect(within(menu).getAllByRole('link')).toHaveLength(3)
  })

  it('rappelle de qui est ce compte', async () => {
    const menu = await menuDe('kenshin')

    expect(within(menu).getByText('kenshin')).toBeInTheDocument()
  })

  it('se referme quand on choisit', async () => {
    const menu = await menuDe('kenshin')

    await userEvent.click(within(menu).getByRole('link', { name: /Paramètres/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('se referme à l’Échap, sans rien choisir', async () => {
    await menuDe('kenshin')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
