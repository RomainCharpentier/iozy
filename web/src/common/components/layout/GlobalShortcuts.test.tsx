/**
 * <b>Les deux boutons de l'en-tête : l'administration, et le profil.</b>
 *
 * <p>C'est le seul accès, depuis n'importe quel écran, à ce qui n'appartient à
 * aucune des quatre intentions quotidiennes. Et ce sont <b>deux</b> boutons,
 * pas un : l'administration a mis trois essais à trouver sa place - sous
 * Paramètres, puis en lien sur Profil, puis dans un menu déroulant de l'avatar
 * - trois fois rangée derrière quelque chose qui appartient à l'utilisateur.
 * Déclarer les catégories de sa collection n'est pas un réglage personnel, et
 * ne se trouve pas en cherchant son profil.
 *
 * <p>Deux <b>liens</b>, et aucun menu : un panneau à ouvrir puis à refermer
 * pour un choix entre deux entrées coûte plus qu'il ne range.
 *
 * <p>Rien ici ne casse bruyamment. L'avatar affiche les mauvaises lettres, un
 * bouton change de cible : l'application continue de fonctionner, un écran
 * devient simplement introuvable autrement qu'en tapant son URL.
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

/** Rend l'en-tête pour un compte donné, une fois celui-ci connu. */
async function avatarDe(pseudo: string) {
  api.lireCompte.mockResolvedValue({ id: 'u1', email: 'qui@example.com', pseudo, admin: false, invite: false })
  render(<GlobalShortcuts />, { wrapper: enrobage })
  return screen.findByRole('link', { name: `Mon profil — ${pseudo}` })
}

describe('l’avatar', () => {
  it('porte les initiales du pseudo connecté', async () => {
    const avatar = await avatarDe('jean-dupont')

    expect(avatar).toHaveTextContent('JD')
  })

  it('nomme la personne pour un lecteur d’écran, pas seulement deux lettres', async () => {
    // « KE » lu à voix haute n'apprend rien : l'intitulé porte le pseudo entier.
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAccessibleName('Mon profil — kenshin')
    expect(avatar).toHaveTextContent('KE')
  })

  it('mène droit au profil, sans panneau à ouvrir', async () => {
    const avatar = await avatarDe('kenshin')

    expect(avatar).toHaveAttribute('href', '/profile')
    expect(avatar).not.toHaveAttribute('aria-haspopup')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

describe('le bouton Administration', () => {
  it('est un accès direct, à côté de l’avatar et non dedans', async () => {
    await avatarDe('kenshin')

    const administration = screen.getByRole('link', { name: 'Administration' })
    expect(administration).toHaveAttribute('href', '/administration')
    // Une icône seule : l'en-tête reste calme, et le nom est porté par
    // aria-label - un title seul ne nomme rien au doigt.
    expect(administration).toHaveAccessibleName('Administration')
  })

  it('n’est pas rangé derrière le profil', async () => {
    // Trois fois de suite, elle l'a été. Ce test est là pour la quatrième.
    await avatarDe('kenshin')

    const acces = screen.getAllByRole('link')
    expect(acces).toHaveLength(2)
    expect(acces.map((a) => a.getAttribute('href'))).toEqual(['/administration', '/profile'])
  })
})

/**
 * <b>Pendant une visite, ces deux boutons ne parlent de personne.</b>
 *
 * Ils désignent tous les deux « chez soi » - son profil, son instance - et un
 * visiteur n'a ni l'un ni l'autre. L'avatar est le pire des deux : il aurait
 * porté les initiales et la couleur de l'HÔTE, c'est-à-dire que le seul
 * endroit de l'application qui dit « c'est toi » aurait affiché le nom de
 * quelqu'un d'autre.
 */
describe('pendant une visite sans compte', () => {
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

  // `waitFor` sur la DISPARITION, et pas une assertion sèche : le composant
  // rend d'abord son repli (« IO », le temps que le compte arrive), et
  // constater son absence à cet instant-là aurait été vert sans rien prouver.
  it('n’affiche pas l’avatar de son hôte comme si c’était le sien', async () => {
    await enVisite()

    await waitFor(() => expect(screen.queryByRole('link', { name: /Mon profil/ })).not.toBeInTheDocument())
  })

  it('n’affiche pas l’administration de l’instance', async () => {
    await enVisite()

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument())
  })

  it('garde le thème : un réglage de l’appareil, pas du compte', async () => {
    await enVisite()

    expect(await screen.findByRole('button', { name: /Passer en thème/ })).toBeInTheDocument()
  })
})

describe('le thème', () => {
  it('se change d’un clic depuis l’en-tête, sans passer par les Paramètres', async () => {
    // Il y vivait, à trois clics de n'importe quel écran (lot 138).
    await avatarDe('romain')

    expect(screen.getByRole('button', { name: /Passer en thème/ })).toBeInTheDocument()
  })
})
