/**
 * <b>The list of accounts, and the gesture that cannot be undone.</b>
 *
 * <p>This screen carries the only irreversible action of the whole application that
 * destroys the data of <b>somebody else</b>. Four rules break here
 * silently - the screen is shown, it just offers the wrong thing:
 * <ul>
 *   <li>the volume is not said, and the user deletes blindly;</li>
 *   <li>one click is enough, without confirmation;</li>
 *   <li>the confirmation does not name what goes away;</li>
 *   <li>"Supprimer" appears on one's OWN row - the server will refuse (409),
 *       but the button will have promised something else.</li>
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
  // A Router: this screen carries a back link to Administration, the only
  // place from which it is reached.
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

describe('the list', () => {
  it('says what each account weighs, in full words', async () => {
    await ecran()

    // The number is not an ornament: it is what one reads before deleting.
    expect(screen.getByText(/412 possessions · 7 envies · 2 classements/)).toBeInTheDocument()
  })

  it('says "aucune donnée" rather than showing zeros', async () => {
    await ecran([MOI])

    expect(screen.getByText(/Aucune donnée/)).toBeInTheDocument()
  })

  it('flags the administrators, and who the user is', async () => {
    await ecran()

    expect(screen.getByText('Administrateur')).toBeInTheDocument()
    expect(screen.getByText('(toi)')).toBeInTheDocument()
  })
})

describe('the deletion', () => {
  it('is not offered on the user own row', async () => {
    // The server refuses it with a 409: a button that only opens a refusal is a
    // door painted on a wall.
    await ecran([MOI])

    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })

  it('asks for confirmation, and names what goes away', async () => {
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    // The confirmation sentence, and not the account row: both carry
    // the volume, and this is intended - it is read before clicking, then again
    // at the moment of confirming.
    const confirmation = screen.getByText(/Supprimer définitivement le compte « bob »/)
    expect(confirmation).toHaveTextContent('412 possessions · 7 envies · 2 classements')
    // What does NOT go away counts as much: the catalog is shared.
    expect(confirmation).toHaveTextContent('Les œuvres du catalogue restent, elles sont partagées')
    // And nothing was sent on the first click.
    expect(apiAdmin.supprimerCompte).not.toHaveBeenCalled()
  })

  it('only sends the request after confirmation', async () => {
    apiAdmin.supprimerCompte.mockResolvedValue(undefined)
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    // The first argument only: TanStack Query adds a second one, its
    // mutation context, which says nothing about the targeted account.
    await waitFor(() => expect(apiAdmin.supprimerCompte).toHaveBeenCalled())
    expect(apiAdmin.supprimerCompte.mock.calls[0][0]).toBe(BOB.id)
  })

  it('gives up without sending anything', async () => {
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByText(/Supprimer définitivement/)).not.toBeInTheDocument()
    expect(apiAdmin.supprimerCompte).not.toHaveBeenCalled()
  })

  it('shows the server refusal as it is', async () => {
    apiAdmin.supprimerCompte.mockRejectedValue(new Error('Un administrateur ne peut pas supprimer son propre compte.'))
    await ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    expect(
      await screen.findByText('Un administrateur ne peut pas supprimer son propre compte.'),
    ).toBeInTheDocument()
  })
})
