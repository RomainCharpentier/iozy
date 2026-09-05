/**
 * <b>La liste des comptes, et le geste qu'on ne rattrape pas.</b>
 *
 * <p>Cet écran porte la seule action irréversible de toute l'application qui
 * détruise les données de <b>quelqu'un d'autre</b>. Quatre règles s'y cassent
 * en silence — l'écran s'affiche, il propose simplement la mauvaise chose :
 * <ul>
 *   <li>le volume n'est pas dit, et on supprime à l'aveugle ;</li>
 *   <li>un clic suffit, sans confirmation ;</li>
 *   <li>la confirmation ne nomme pas ce qui part ;</li>
 *   <li>« Supprimer » apparaît sur sa PROPRE ligne — le serveur refusera (409),
 *       mais le bouton aura promis autre chose.</li>
 * </ul>
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ComptesPage } from './ComptesPage'
import type { CompteAdministre } from '@/common/api/admin'

const apiAdmin = vi.hoisted(() => ({ listerComptes: vi.fn(), supprimerCompte: vi.fn() }))
vi.mock('@/common/api/admin', () => apiAdmin)

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

function compte(options: Partial<CompteAdministre> & { pseudo: string }): CompteAdministre {
  const volume = { possessions: 0, envies: 0, experiences: 0, classements: 0, analyses: 0, total: 0 }
  return {
    id: options.pseudo,
    email: `${options.pseudo}@example.com`,
    admin: false,
    creeLe: '2026-08-01T10:00:00Z',
    ...options,
    volume: { ...volume, ...options.volume },
  }
}

const MOI = compte({ pseudo: 'romain', admin: true })
const BOB = compte({
  pseudo: 'bob',
  volume: { possessions: 412, envies: 7, experiences: 0, classements: 2, analyses: 0, total: 421 },
})

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  // Un Router : cet écran porte un lien de retour vers Administration, le seul
  // endroit d'où on l'atteint.
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

async function ecran(comptes: CompteAdministre[] = [MOI, BOB]) {
  apiAdmin.listerComptes.mockResolvedValue(comptes)
  render(<ComptesPage />, { wrapper: enrobage })
  await waitFor(() => expect(screen.getByText('romain')).toBeInTheDocument())
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.useAuth.mockReturnValue({ compte: { id: MOI.id, email: MOI.email, pseudo: MOI.pseudo, admin: true } })
})

describe('la liste', () => {
  it('dit ce que chaque compte pèse, en toutes lettres', async () => {
    await ecran()

    // Le nombre n'est pas un ornement : c'est lui qu'on lit avant de supprimer.
    expect(screen.getByText(/412 possessions · 7 envies · 2 classements/)).toBeInTheDocument()
  })

  it('dit « aucune donnée » plutôt que d’afficher des zéros', async () => {
    await ecran([MOI])

    expect(screen.getByText(/Aucune donnée/)).toBeInTheDocument()
  })

  it('signale les administrateurs, et qui est soi', async () => {
    await ecran()

    expect(screen.getByText('Administrateur')).toBeInTheDocument()
    expect(screen.getByText('(toi)')).toBeInTheDocument()
  })
})

describe('la suppression', () => {
  it('n’est pas proposée sur sa propre ligne', async () => {
    // Le serveur la refuse en 409 : un bouton qui n'ouvre qu'un refus est une
    // porte peinte sur un mur.
    await ecran([MOI])

    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })

  it('demande confirmation, et nomme ce qui part', async () => {
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    // La phrase de confirmation, et non la ligne du compte : les deux portent
    // le volume, et c'est voulu - on le lit avant de cliquer, puis à nouveau
    // au moment de confirmer.
    const confirmation = screen.getByText(/Supprimer définitivement le compte « bob »/)
    expect(confirmation).toHaveTextContent('412 possessions · 7 envies · 2 classements')
    // Ce qui NE part pas compte autant : le catalogue est partagé.
    expect(confirmation).toHaveTextContent('Les œuvres du catalogue restent, elles sont partagées')
    // Et rien n'a été envoyé sur le premier clic.
    expect(apiAdmin.supprimerCompte).not.toHaveBeenCalled()
  })

  it('n’envoie la demande qu’après confirmation', async () => {
    apiAdmin.supprimerCompte.mockResolvedValue(undefined)
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    // Le premier argument seulement : TanStack Query en ajoute un second, son
    // contexte de mutation, qui ne dit rien du compte visé.
    await waitFor(() => expect(apiAdmin.supprimerCompte).toHaveBeenCalled())
    expect(apiAdmin.supprimerCompte.mock.calls[0][0]).toBe(BOB.id)
  })

  it('renonce sans rien envoyer', async () => {
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByText(/Supprimer définitivement/)).not.toBeInTheDocument()
    expect(apiAdmin.supprimerCompte).not.toHaveBeenCalled()
  })

  it('affiche le refus du serveur tel quel', async () => {
    apiAdmin.supprimerCompte.mockRejectedValue(new Error('Un administrateur ne peut pas supprimer son propre compte.'))
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    expect(
      await screen.findByText('Un administrateur ne peut pas supprimer son propre compte.'),
    ).toBeInTheDocument()
  })
})
