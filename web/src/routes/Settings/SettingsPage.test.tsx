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
vi.mock('../../lib/useAuth', () => auth)

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
  it('dit qui on est, et permet de sortir', () => {
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).getByText('romain')).toBeInTheDocument()
    expect(within(monCompte).getByText('romain@iozycore.local')).toBeInTheDocument()
    expect(within(monCompte).getByRole('button', { name: /Se déconnecter/ })).toBeInTheDocument()
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
  it('prévient que ces réglages ne suivent pas le compte', () => {
    // Thème et langue des titres vivent dans le localStorage de ce navigateur.
    // Sans cette phrase, personne ne peut le deviner.
    expect(screen.getByText(/restent sur cet appareil/)).toBeInTheDocument()
    expect(screen.getByText(/ne suivent pas ton compte/)).toBeInTheDocument()
  })

  it('garde le thème et la langue des titres', () => {
    expect(screen.getByRole('switch', { name: 'Thème sombre' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Titre des mangas' })).toBeInTheDocument()
  })
})

describe('le lien vers l’administration', () => {
  it('nomme ce qui s’y trouve, et rien de ce qui a déménagé', () => {
    const lien = screen.getByRole('link', { name: /Administration/ })

    expect(lien).toHaveAttribute('href', '/administration')
    // Le libellé annonçait « export brut des données » alors que l'export est
    // désormais ici : une description périmée est un mensonge d'un clic.
    expect(lien).not.toHaveTextContent(/export/i)
  })
})
