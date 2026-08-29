/**
 * <b>La porte, vue par quelqu'un qui n'est pas encore entré.</b>
 *
 * C'est le seul écran que voit un inconnu, et il doit se lire sans notice.
 * Trois règles s'y cassent en silence - l'écran s'affiche, il propose
 * simplement la mauvaise chose :
 * <ul>
 *   <li>une instance <b>neuve</b> propose de créer le premier compte, et dit
 *       qu'il reprendra la collection déjà enregistrée ; une instance en
 *       service propose de <b>se connecter</b> ;</li>
 *   <li>le <b>code d'invitation</b> n'apparaît que là où il est exigé - le
 *       premier compte n'en a pas besoin, et le demander laisserait croire
 *       qu'il en faut un ;</li>
 *   <li>une instance <b>fermée</b> aux nouveaux comptes ne propose pas d'en
 *       créer : le lien n'ouvrirait qu'un refus.</li>
 * </ul>
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthPage } from './AuthPage'
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Rend l'écran pour une instance donnée, une fois son état connu. */
async function ecran(etat: { aucunCompte: boolean; creationOuverte: boolean }) {
  api.lireEtatAuth.mockResolvedValue(etat)
  // Personne n'est connecté : c'est la situation NORMALE devant cette porte.
  api.lireCompte.mockRejectedValue(new ApiError(401, 'Non connecté'))
  render(<AuthPage />, { wrapper: enrobage })
  await waitFor(() => expect(api.lireEtatAuth).toHaveBeenCalled())
}

beforeEach(() => vi.clearAllMocks())

describe('une instance neuve', () => {
  it('propose de créer le premier compte, et dit ce qu’il reprend', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument())
    expect(screen.getByText(/reprend la collection déjà enregistrée/)).toBeInTheDocument()
  })

  it('ne demande pas de code d’invitation pour le premier compte', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Créer un compte' })).toBeInTheDocument())
    expect(screen.queryByLabelText(/invitation/i)).not.toBeInTheDocument()
  })

  it('annonce la longueur minimale plutôt que de la faire découvrir par un refus', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    await waitFor(() => expect(screen.getByText('Au moins 10 caractères.')).toBeInTheDocument())
  })

  it('exige un pseudo, et dit à quoi il sert avant qu’on le tape', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })

    // Facultatif jusqu'au 2026-08-29 : laissé vide, il retombait sur l'adresse
    // e-mail, qui s'affichait ensuite sur l'avatar du menu.
    await waitFor(() => expect(screen.getByLabelText('Pseudo')).toBeRequired())
    // La règle est RATTACHÉE au champ (aria-describedby), pas seulement posée
    // à côté : sans ce lien, elle n'existe que pour qui voit l'écran.
    expect(screen.getByLabelText('Pseudo')).toHaveAccessibleDescription(
      /3 à 24 caractères, sans espace.*nom sous lequel tu apparais/,
    )
  })

  it('transmet le pseudo saisi, débarrassé de ses espaces de bord', async () => {
    await ecran({ aucunCompte: true, creationOuverte: true })
    await waitFor(() => expect(screen.getByLabelText('Pseudo')).toBeInTheDocument())
    api.creerCompte.mockResolvedValue({ id: 'u1', email: 'romain@example.com', pseudo: 'romain', admin: true })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'romain@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe')
    await userEvent.type(screen.getByLabelText('Pseudo'), '  romain  ')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    // Le premier argument seulement : TanStack Query en ajoute un second
    // (son contexte de mutation), qui ne dit rien de ce qui a été saisi.
    await waitFor(() => expect(api.creerCompte).toHaveBeenCalled())
    expect(api.creerCompte.mock.calls[0][0]).toEqual({
      email: 'romain@example.com',
      motDePasse: 'un-mot-de-passe',
      pseudo: 'romain',
      codeInvitation: undefined,
    })
  })

  it('affiche le refus du serveur quand le pseudo est déjà pris', async () => {
    // Contrairement à un échec de connexion, ce refus est EXPLICITE : un
    // pseudo est public par destination, le taire empêcherait seulement la
    // personne concernée d'en choisir un autre.
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

describe('une instance en service', () => {
  it('propose de se connecter', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
  })

  it('ne propose pas de créer un compte quand la création est fermée', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Créer un compte/ })).not.toBeInTheDocument()
  })

  it('demande le code d’invitation dès qu’on bascule vers la création', async () => {
    await ecran({ aucunCompte: false, creationOuverte: true })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /Créer un compte avec une invitation/ }))

    expect(screen.getByLabelText(/invitation/i)).toBeRequired()
  })
})

describe('la connexion', () => {
  it('transmet ce qui a été saisi, et rien d’autre', async () => {
    await ecran({ aucunCompte: false, creationOuverte: false })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
    api.seConnecter.mockResolvedValue({ id: 'u1', email: 'romain@example.com', pseudo: 'romain', admin: true })

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), '  romain@example.com  ')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'un-mot-de-passe')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() =>
      // L'adresse est débarrassée de ses espaces de bord ; le mot de passe,
      // lui, part tel quel - un espace y est un caractère comme un autre.
      expect(api.seConnecter).toHaveBeenCalledWith('romain@example.com', 'un-mot-de-passe'),
    )
  })

  it('affiche le refus du serveur tel quel, sans le reformuler', async () => {
    // C'est le serveur qui décide de ce qui se dit : il rend volontairement le
    // même message pour une adresse inconnue et un mot de passe faux.
    await ecran({ aucunCompte: false, creationOuverte: false })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Se connecter' })).toBeInTheDocument())
    api.seConnecter.mockRejectedValue(new Error('Adresse ou mot de passe incorrect.'))

    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'romain@example.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais-mot-de-passe')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Adresse ou mot de passe incorrect.')).toBeInTheDocument()
  })
})
