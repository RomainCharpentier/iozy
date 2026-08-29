/**
 * <b>Les deux boutons de l'en-tête : l'administration, et le compte.</b>
 *
 * <p>C'est le seul accès, depuis n'importe quel écran, à ce qui n'appartient à
 * aucune des quatre intentions quotidiennes. Et ce sont <b>deux</b> boutons,
 * pas un : l'administration a mis trois essais à trouver sa place - sous
 * Paramètres, puis en lien sur Profil, puis dans le menu de l'avatar - trois
 * fois rangée derrière quelque chose qui appartient à l'utilisateur. Déclarer
 * les catégories de sa collection n'est pas un réglage personnel, et ne se
 * trouve pas en cherchant son profil.
 *
 * <p>Rien ici ne casse bruyamment. L'avatar affiche les mauvaises lettres, un
 * bouton disparaît, une entrée du menu change de cible : l'application continue
 * de fonctionner, un écran devient simplement introuvable autrement qu'en
 * tapant son URL.
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

describe('le bouton Administration', () => {
  it('est un accès direct, à côté de l’avatar et non dedans', async () => {
    await avatarDe('kenshin')

    const administration = screen.getByRole('link', { name: 'Administration' })
    expect(administration).toHaveAttribute('href', '/administration')
    // Une icône seule : l'en-tête reste calme, et le nom est porté par
    // aria-label - un title seul ne nomme rien au doigt.
    expect(administration).toHaveAccessibleName('Administration')
  })

  it('n’est pas rangé dans le menu du compte', async () => {
    // Trois fois de suite, elle y a été mise. Ce test est là pour la
    // quatrième.
    const menu = await menuDe('kenshin')

    expect(within(menu).queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })
})

describe('le menu du compte', () => {
  it('ne porte que ce qui est personnel', async () => {
    const menu = await menuDe('kenshin')

    expect(within(menu).getByRole('link', { name: /Mon profil/ })).toHaveAttribute('href', '/profile')
    expect(within(menu).getByRole('link', { name: /Paramètres/ })).toHaveAttribute('href', '/settings')
    expect(within(menu).getAllByRole('link')).toHaveLength(2)
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
