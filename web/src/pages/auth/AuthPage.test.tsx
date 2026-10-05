/**
 * <b>The gate, seen by someone who has not entered yet.</b>
 *
 * It is the only screen an unknown visitor sees, and it must read without a manual.
 * Three rules break silently here - the screen is shown, it just
 * offers the wrong thing:
 * <ul>
 *   <li>a <b>new</b> instance offers to create the first account, and says
 *       that it will take over the collection already saved; an instance in
 *       service offers to <b>sign in</b>;</li>
 *   <li>the <b>invitation code</b> only appears where it is required - the
 *       first account does not need one, and asking for it would suggest
 *       that one is needed;</li>
 *   <li>an instance <b>closed</b> to new accounts does not offer to
 *       create one: the link would only open a refusal;</li>
 *   <li>"<b>visiter sans compte</b>" is always offered - there is nothing to
 *       authorize, and the catalog belongs to nobody.</li>
 * </ul>
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthPage } from './AuthPage'
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Renders the screen for a given instance, once its state is known. */
async function ecran(etat: { aucunCompte: boolean; creationOuverte: boolean }) {
  api.lireEtatAuth.mockResolvedValue(etat)
  // Nobody is signed in: this is the NORMAL situation in front of this gate.
  api.lireCompte.mockRejectedValue(new ApiError(401, 'Non connecté'))
  render(<AuthPage />, { wrapper: enrobage })
  await waitFor(() => expect(api.lireEtatAuth).toHaveBeenCalled())
}

beforeEach(() => vi.clearAllMocks())

describe('which delivery is running', () => {
  it('can be read on the gate, without having to enter', async () => {
    // The gate replaces the whole shell, footer included: without this
    // line, the only screen seen when the user does NOT enter is also the only one
    // that does not say what is running.
    await ecran({ aucunCompte: false, creationOuverte: false })

    expect(await screen.findByText(/^Version /)).toBeInTheDocument()
  })
})

describe('a new instance', () => {
  it('offers to create the first account, and says what it takes over', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument())
    expect(screen.getByText(/reprend la collection déjà enregistrée/)).toBeInTheDocument()
  })

  it('does not ask for an invitation code for the first account', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument())
    expect(screen.queryByLabelText(/invitation/i)).not.toBeInTheDocument()
  })

  it('announces the minimum length rather than letting a refusal reveal it', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    await waitFor(() => expect(screen.getByText('Au moins 10 caractères.')).toBeInTheDocument())
  })

  it('requires a username, and says what it is for before it is typed', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    // Optional until 2026-08-29: left empty, it fell back to the e-mail
    // address, which was then shown on the menu avatar.
    await waitFor(() => expect(screen.getByLabelText('Pseudo')).toBeRequired())
    // The rule is ATTACHED to the field (aria-describedby), not only placed
    // next to it: without this link, it exists only for who sees the screen.
    expect(screen.getByLabelText('Pseudo')).toHaveAccessibleDescription(
      /3 à 24 caractères, sans espace.*nom sous lequel tu apparais/,
    )
  })

  it('sends the typed username, without its edge spaces', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })
    await waitFor(() => expect(screen.getByLabelText('Pseudo')).toBeInTheDocument())
    api.creerCompte.mockResolvedValue({ id: 'u1', email: 'romain@example.com', pseudo: 'romain', admin: true })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'romain@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe')
    await userEvent.type(screen.getByLabelText('Pseudo'), '  romain  ')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    // Only the first argument: TanStack Query adds a second one
    // (its mutation context), which says nothing about what was typed.
    await waitFor(() => expect(api.creerCompte).toHaveBeenCalled())
    expect(api.creerCompte.mock.calls[0][0]).toEqual({
      email: 'romain@example.com',
      motDePasse: 'un-mot-de-passe',
      pseudo: 'romain',
      codeInvitation: undefined,
    })
  })

  it('shows the server refusal when the username is already taken', async () => {
    // Unlike a sign-in failure, this refusal is EXPLICIT: a
    // username is public by design, hiding it would only stop the
    // person from choosing another one.
    await ecran({ aucunCompte: true, creationOuverte: true })
    await waitFor(() => expect(screen.getByLabelText('Pseudo')).toBeInTheDocument())
    api.creerCompte.mockRejectedValue(new Error('Ce pseudo est déjà pris.'))

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'romain@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe')
    await userEvent.type(screen.getByLabelText('Pseudo'), 'romain')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Ce pseudo est déjà pris.')).toBeInTheDocument()
  })
})

describe('an instance in service', () => {
  it('offers to sign in', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
  })

  it('does not offer to create an account when creation is closed', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Créer un compte/ })).not.toBeInTheDocument()
  })

  it('asks for the invitation code as soon as the user switches to creation', async () => {
    await ecran({ aucunCompte: false, creationOuverte: true })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /Créer un compte avec une invitation/ }))

    expect(screen.getByLabelText(/invitation/i)).toBeRequired()
  })
})

describe('the sign-in', () => {
  it('sends what was typed, and nothing else', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
    api.seConnecter.mockResolvedValue({ id: 'u1', email: 'romain@example.com', pseudo: 'romain', admin: true })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), '  romain@example.com  ')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() =>
      // The address has its edge spaces removed; the password
      // is sent as it is - a space is a character like any other there.
      expect(api.seConnecter).toHaveBeenCalledWith('romain@example.com', 'un-mot-de-passe'),
    )
  })

  it('shows the server refusal as it is, without rewording it', async () => {
    // The server decides what is said: it deliberately returns the
    // same message for an unknown address and a wrong password.
    await ecran({ aucunCompte: false, creationOuverte: false })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
    api.seConnecter.mockRejectedValue(new Error('Adresse ou mot de passe incorrect.'))

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'romain@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais-mot-de-passe')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Adresse ou mot de passe incorrect.')).toBeInTheDocument()
  })
})

/**
 * <b>The fourth way out: entering without an account.</b>
 *
 * It leads to the CATALOG - the works the instance knows - and not to the
 * collection of someone. No setting conditions it: there is nothing to
 * authorize, and nothing personal comes out of it.
 */
describe('the visit without an account', () => {
  it('is offered without condition, and says that it is read-only', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })

    expect(await screen.findByRole('button', { name: 'Visiter sans compte' })).toBeInTheDocument()
    // The constraint is written BEFORE entering: someone who discovers
    // the application must know what they will be able to do, not guess it from a
    // button that refuses.
    expect(screen.getByText(/lecture seule/)).toBeInTheDocument()
  })

  it('opens the visit session without asking to type anything', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })
    api.entrerEnVisite.mockResolvedValue({
      id: null,
      email: null,
      pseudo: 'Visiteur',
      admin: false,
      invite: true,
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Visiter sans compte' }))

    await waitFor(() => expect(api.entrerEnVisite).toHaveBeenCalled())
  })
})
