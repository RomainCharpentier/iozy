/**
 * <b>The settings follow the account, apply at once, and say where they live.</b>
 *
 * <p>Lot 218: one panel for both apps. The silent defects it guards against:
 * a pseudo refused without its reason (or with the field emptied), a choice
 * that applies on screen but never reaches the account, a blindtest sound
 * saved on every step of a drag, a fallback to the device that the panel does
 * not admit, and the export or the restore lost again somewhere else.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { Reglages } from './Reglages'
import { applyStoredTheme } from '@/common/lib/theme'
import { relireAccent } from '@/common/lib/accent'
import {
  EVENEMENT_PREFERENCE_CHOISIE,
  declarerEnregistrement,
  type ChoixPreference,
} from '@/common/lib/preferencesCompte'
import type { Compte } from '@/common/api/auth'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)
const api = vi.hoisted(() => ({ modifierCompte: vi.fn() }))
vi.mock('@/common/api/auth', () => api)

const COMPTE: Compte = {
  id: 'u1',
  email: 'romain@iozycore.local',
  pseudo: 'romain',
  admin: false,
  invite: false,
  preferences: { accent: null, appearance: null, titleComposition: null, blindtestSound: null },
}

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function afficher(compte: Compte = COMPTE) {
  auth.useAuth.mockReturnValue({ compte })
  render(<Reglages />, { wrapper: enrobage })
}

const choix: ChoixPreference[] = []
const ecoute = (e: Event) => choix.push((e as CustomEvent<ChoixPreference>).detail)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  applyStoredTheme()
  relireAccent()
  declarerEnregistrement('repos')
  choix.length = 0
  window.addEventListener(EVENEMENT_PREFERENCE_CHOISIE, ecoute)
  api.modifierCompte.mockImplementation(async (m) => ({ ...COMPTE, ...m }))
})

afterEach(() => {
  window.removeEventListener(EVENEMENT_PREFERENCE_CHOISIE, ecoute)
  vi.useRealTimers()
})

describe('the pseudo', () => {
  it('is changed in place and saved on the account', async () => {
    afficher()

    await userEvent.click(screen.getByRole('button', { name: 'Modifier le pseudo' }))
    const champ = screen.getByLabelText('Nouveau pseudo')
    await userEvent.clear(champ)
    await userEvent.type(champ, 'neo-2')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(api.modifierCompte).toHaveBeenCalledWith({ pseudo: 'neo-2' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Modifier le pseudo' })).toHaveFocus())
  })

  it('says why the server refuses it, and keeps what was typed', async () => {
    api.modifierCompte.mockRejectedValue(new Error('Ce pseudo est déjà pris.'))
    afficher()

    await userEvent.click(screen.getByRole('button', { name: 'Modifier le pseudo' }))
    const champ = screen.getByLabelText('Nouveau pseudo')
    await userEvent.clear(champ)
    await userEvent.type(champ, 'pris')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce pseudo est déjà pris.')
    expect(screen.getByLabelText('Nouveau pseudo')).toHaveValue('pris')
  })
})

describe('the appearance and the color', () => {
  it('apply at once and are announced for the account', async () => {
    afficher()

    await userEvent.click(screen.getByRole('radio', { name: 'Clair' }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('iozycore.theme')).toBe('light')

    await userEvent.click(screen.getByRole('radio', { name: 'Terracotta' }))
    expect(screen.getByRole('radio', { name: 'Terracotta' })).toBeChecked()
    expect(screen.getByText('La couleur d’Iozy partout, quelle que soit la jaquette.')).toBeInTheDocument()

    expect(choix).toEqual([{ appearance: 'LIGHT' }, { accent: 'TERRACOTTA' }])
  })

  it('offers to follow the system', async () => {
    afficher()

    await userEvent.click(screen.getByRole('radio', { name: 'Système' }))

    expect(localStorage.getItem('iozycore.theme')).toBe('system')
    expect(choix).toEqual([{ appearance: 'SYSTEM' }])
  })
})

describe('the title languages', () => {
  it('read in one line, and their order changes with the arrows', async () => {
    afficher()
    expect(screen.getByText('Français, puis romaji')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Changer l’ordre' }))
    const ordre = () =>
      within(screen.getByRole('list', { name: 'Ordre des langues de titre' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent ?? '')
    expect(screen.getByRole('button', { name: 'Monter Français' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Descendre Français' }))

    expect(ordre()[0]).toContain('Romaji')
    expect(screen.getByText('Romaji, puis français')).toBeInTheDocument()
    expect(choix.at(-1)?.titleComposition?.[0]).toEqual({ language: 'ROMAJI', enabled: true })
  })
})

describe('the blindtest sound', () => {
  it('shows IozyTest’s default until the account has one, and says so', () => {
    afficher()

    expect(screen.getByRole('switch', { name: 'Effets sonores' })).toBeChecked()
    expect(screen.getByText('70 %')).toBeInTheDocument()
    expect(screen.getByText(/Pas encore réglé sur ton compte/)).toBeInTheDocument()
  })

  it('is saved on the account when switched off', async () => {
    afficher()

    await userEvent.click(screen.getByRole('switch', { name: 'Effets sonores' }))

    expect(api.modifierCompte).toHaveBeenCalledWith({ preferences: { blindtestSound: { enabled: false, volume: 70 } } })
  })

  it('saves a volume once the slider rests, not at every step', async () => {
    vi.useFakeTimers()
    afficher({ ...COMPTE, preferences: { ...COMPTE.preferences!, blindtestSound: { enabled: true, volume: 40 } } })
    const curseur = screen.getByRole('slider', { name: 'Volume du blindtest' })

    fireEvent.change(curseur, { target: { value: '45' } })
    fireEvent.change(curseur, { target: { value: '50' } })
    fireEvent.change(curseur, { target: { value: '55' } })
    expect(api.modifierCompte).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(api.modifierCompte).toHaveBeenCalledTimes(1)
    expect(api.modifierCompte).toHaveBeenCalledWith({ preferences: { blindtestSound: { enabled: true, volume: 55 } } })
  })
})

describe('where a setting lives', () => {
  it('admits when the account did not answer and the device keeps the choice', () => {
    afficher()
    expect(screen.getByRole('status')).toHaveTextContent('Ces réglages suivent ton compte')

    act(() => declarerEnregistrement('appareil'))

    expect(screen.getByRole('status')).toHaveTextContent('ce réglage reste sur cet appareil')
  })
})

describe('the data', () => {
  it('can be taken away and brought back from the account panel', () => {
    afficher()
    const monCompte = screen.getByRole('region', { name: 'Mon compte' })

    expect(within(monCompte).getByRole('link', { name: 'Télécharger en JSON' })).toHaveAttribute(
      'href',
      '/api/export/json',
    )
    expect(within(monCompte).getByRole('link', { name: /Télécharger en CSV/ })).toHaveAttribute(
      'href',
      '/api/export/csv',
    )
    expect(within(monCompte).getByRole('link', { name: 'Importer un fichier' })).toHaveAttribute(
      'href',
      '/profile/import',
    )
  })
})
