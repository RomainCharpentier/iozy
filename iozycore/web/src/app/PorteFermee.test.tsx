/**
 * <b>A server that does not answer is not a signed-out user.</b> When
 * `/auth/me` fails with anything else than a 401, the gate says so and
 * offers to ask again, instead of a sign-in form.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/common/api/client'
import { queryKeys } from '@/common/lib/queryKeys'
import { PorteFermee } from './App'

const api = vi.hoisted(() => ({ lireCompte: vi.fn(), lireEtatAuth: vi.fn() }))
vi.mock('@/common/api/auth', async (original) => ({
  ...(await original<typeof import('@/common/api/auth')>()),
  lireCompte: api.lireCompte,
  lireEtatAuth: api.lireEtatAuth,
}))
vi.mock('@/pages/auth/AuthPage', () => ({ AuthPage: () => <p>Formulaire de connexion</p> }))

const compte = { id: '1', email: 'a@exemple.test', pseudo: 'A', admin: false, invite: false }

function rendre() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PorteFermee>
        <p>La collection</p>
      </PorteFermee>
    </QueryClientProvider>,
  )
  return client
}

beforeEach(() => {
  api.lireCompte.mockReset()
  api.lireEtatAuth.mockReset().mockResolvedValue({ aucunCompte: false, creationOuverte: false })
})

describe('the gate', () => {
  it('shows the error and a retry button when the server fails, not the sign-in form', async () => {
    api.lireCompte.mockRejectedValueOnce(new ApiError(502, 'Le serveur ne répond pas.'))
    rendre()

    expect(await screen.findByText('Le serveur ne répond pas.')).toBeInTheDocument()
    expect(screen.queryByText('Formulaire de connexion')).not.toBeInTheDocument()

    api.lireCompte.mockResolvedValueOnce(compte)
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('La collection')).toBeInTheDocument()
  })

  it('keeps the account already read when a later check fails', async () => {
    api.lireCompte.mockResolvedValueOnce(compte)
    const client = rendre()
    expect(await screen.findByText('La collection')).toBeInTheDocument()

    api.lireCompte.mockRejectedValueOnce(new ApiError(502, 'Le serveur ne répond pas.'))
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.auth.compte })
      // TanStack Query tells its observers on the next macrotask.
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(client.getQueryState(queryKeys.auth.compte)?.status).toBe('error')

    expect(screen.getByText('La collection')).toBeInTheDocument()
    expect(screen.queryByText('Le serveur ne répond pas.')).not.toBeInTheDocument()
  })

  it('still shows the sign-in form when nobody is signed in (401)', async () => {
    api.lireCompte.mockRejectedValueOnce(new ApiError(401, 'Non connecté'))
    rendre()

    expect(await screen.findByText('Formulaire de connexion')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })
})
