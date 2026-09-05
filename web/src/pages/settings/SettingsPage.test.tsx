/**
 * <b>« Mon compte » et « Cet appareil » ne sont pas la même chose, et l'écran
 * doit le dire.</b>
 *
 * <p>C'est le seul écran de l'application qui mélange deux natures de
 * réglages : ce qui vit sur le serveur et te suit partout, et ce qui vit dans
 * le `localStorage` de CE navigateur et se perd en changeant de machine. Rien
 * ne distingue les deux à l'œil — un interrupteur ressemble à un interrupteur.
 *
 * <p>Deux défauts silencieux, donc : la phrase qui prévient disparaît (et
 * quelqu'un croit à une perte de réglage en ouvrant l'app sur son téléphone),
 * ou l'export s'égare à nouveau dans l'administration (et emporter ses données
 * redevient une affaire de configuration technique).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SettingsPage } from './SettingsPage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const deconnexion = { mutate: vi.fn(), isPending: false }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  auth.useAuth.mockReturnValue({
    compte: { id: 'u1', email: 'romain@iozycore.local', pseudo: 'romain', admin: true },
    deconnexion,
  })
  render(<SettingsPage />, { wrapper: enrobage })
})

describe('« Mon compte »', () => {
  it('dit qui on est', () => {
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).getByText('romain')).toBeInTheDocument()
    expect(within(monCompte).getByText('romain@iozycore.local')).toBeInTheDocument()
  })

  it('ne porte plus la déconnexion, qui est remontée dans l’en-tête', () => {
    // Elle vivait ici, à trois clics de l'avatar (Profil, puis Paramètres,
    // puis cette section) : introuvable pour qui ne connaît pas le chemin. Il
    // n'y a plus qu'UN bouton de sortie, dans l'en-tête, le même pour un
    // compte et pour un visiteur (voir BoutonSortie).
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).queryByRole('button', { name: /déconnecter/i })).not.toBeInTheDocument()
  })

  it('porte l’export, qui appartient au compte et non à l’administration', () => {
    // Emporter sa collection est la garantie de pouvoir partir, pas de la
    // configuration technique : c'est le compte qui possède ces données.
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).getByRole('link', { name: 'Télécharger en JSON' })).toHaveAttribute(
      'href',
      '/api/export/json',
    )
    expect(within(monCompte).getByRole('link', { name: /Télécharger en CSV/ })).toHaveAttribute(
      'href',
      '/api/export/csv',
    )
  })
})

describe('« Cet appareil »', () => {
  it('prévient que ce réglage ne suit pas le compte', () => {
    // La langue des titres vit dans le localStorage de ce navigateur. Sans
    // cette phrase, personne ne peut le deviner.
    expect(screen.getByText(/reste sur cet appareil/)).toBeInTheDocument()
    expect(screen.getByText(/ne suit pas ton compte/)).toBeInTheDocument()
  })

  it('garde la langue des titres, et dit où le thème est parti', () => {
    // L'interrupteur du thème a vécu ici jusqu'au lot 138. Il est dans
    // l'en-tête, d'un clic sur le soleil ou la lune - et cet écran le dit,
    // pour qui vient le chercher là où il l'a connu.
    expect(screen.queryByRole('switch', { name: 'Thème sombre' })).not.toBeInTheDocument()
    expect(screen.getByText(/soleil ou la lune/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Titre des mangas' })).toBeInTheDocument()
  })
})

describe('l’administration', () => {
  it('n’est plus une sous-partie des réglages', () => {
    // Elle a vécu ici jusqu'au 2026-08-29, en bas de page. Régler son thème et
    // déclarer les catégories de sa collection n'ont rien à voir : ce sont deux
    // écrans SŒURS, atteints tous deux depuis Profil. Emboîtée, elle mettait
    // les éditions de référence à trois niveaux de profondeur.
    expect(screen.queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })

  it('n’emporte pas les réglages de cet appareil avec elle', () => {
    // Le déplacement ne doit vider ni l'une ni l'autre des deux sections.
    expect(screen.getByRole('region', { name: 'Mon compte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Titre des mangas' })).toBeInTheDocument()
  })
})
