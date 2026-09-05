/**
 * <b>La seule source de prix réellement constatés, et le geste qui la
 * remplit.</b>
 *
 * <p>Un relevé alimente toutes les analyses d'achat suivantes de son édition.
 * Jusqu'au 2026-08-29, la seule façon d'en enregistrer un était d'analyser une
 * annonce, puis d'ouvrir le détail d'une de ses séries — et seulement si
 * l'édition était reconnue et les tomes contigus. La capacité la plus
 * déterminante de l'application était la plus cachée (§16 des parcours).
 *
 * <p>Pire : quand une édition n'avait aucun relevé, ce bloc ne s'affichait
 * <b>pas du tout</b>. Rien ne disait que ces prix existaient, et c'est
 * exactement là qu'il faut pouvoir en saisir un.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { EditionObservations } from './EditionObservations'

const api = vi.hoisted(() => ({
  listMarketObservations: vi.fn(),
  recordMarketObservation: vi.fn(),
  deleteMarketObservation: vi.fn(),
}))
vi.mock('@/common/api/purchaseAnalysis', () => api)

const toast = vi.hoisted(() => ({ useToast: () => vi.fn() }))
vi.mock('@/common/lib/toast', () => toast)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

async function ecran() {
  render(<EditionObservations editionId="ed-1" editionName="Standard" />, { wrapper: enrobage })
  await waitFor(() => expect(api.listMarketObservations).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listMarketObservations.mockResolvedValue([])
  api.recordMarketObservation.mockResolvedValue({})
})

/** Ouvre le formulaire et remplit ce qui est exigé. */
async function saisirUnPrix(prix: string) {
  await userEvent.click(screen.getByRole('button', { name: /Relever un prix/ }))
  await userEvent.type(screen.getByLabelText(/Prix constaté/), prix)
}

describe('une édition sans aucun relevé', () => {
  it('dit que ces prix existent, au lieu de ne rien montrer', async () => {
    await ecran()

    expect(await screen.findByText(/Aucun prix relevé pour cette édition/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Relever un prix/ })).toBeInTheDocument()
  })
})

describe('relever un prix à la main', () => {
  it('transmet le prix, la plateforme et la date', async () => {
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    const envoye = api.recordMarketObservation.mock.calls[0][0]
    expect(envoye.mangaEditionId).toBe('ed-1')
    expect(envoye.observedPrice).toBe(45)
    expect(envoye.platform).toBe('VINTED')
    // Un relevé est un fait DATÉ : la date part toujours, pré-remplie à
    // aujourd'hui.
    expect(envoye.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('n’envoie une portée que si les DEUX bornes sont saisies', async () => {
    // Une portée à moitié remplie ne décrit rien, et le serveur l'ignorerait en
    // silence - autant ne pas la lui envoyer.
    await ecran()
    await saisirUnPrix('45')
    await userEvent.type(screen.getByLabelText('Premier tome du lot'), '1')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    const envoye = api.recordMarketObservation.mock.calls[0][0]
    expect(envoye.volumeRangeStart).toBeUndefined()
    expect(envoye.volumeRangeEnd).toBeUndefined()
  })

  it('envoie la portée quand elle est complète, et le dit avant', async () => {
    await ecran()
    await saisirUnPrix('90')
    await userEvent.type(screen.getByLabelText('Premier tome du lot'), '1')
    await userEvent.type(screen.getByLabelText('Dernier tome du lot'), '6')

    // Ce que ce prix décrira, annoncé AVANT d'enregistrer : sans portée il
    // couvre l'édition entière, ce qui ne se devine pas.
    expect(screen.getByText('Ce prix décrira les tomes 1 à 6.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    const envoye = api.recordMarketObservation.mock.calls[0][0]
    expect(envoye.volumeRangeStart).toBe(1)
    expect(envoye.volumeRangeEnd).toBe(6)
  })

  it('n’invente pas un état quand il n’est pas précisé', async () => {
    // « Bon état » par défaut fausserait toutes les comparaisons dans le sens
    // optimiste.
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    expect(api.recordMarketObservation.mock.calls[0][0].observedCondition).toBeUndefined()
  })

  it('renonce sans rien envoyer', async () => {
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByLabelText(/Prix constaté/)).not.toBeInTheDocument()
    expect(api.recordMarketObservation).not.toHaveBeenCalled()
  })

  it('affiche le refus du serveur tel quel', async () => {
    api.recordMarketObservation.mockRejectedValue(new Error('Le prix doit être strictement positif.'))
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le prix doit être strictement positif.')).toBeInTheDocument()
  })
})
