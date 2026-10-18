/**
 * <b>The only source of prices actually observed, and the action that
 * fills it.</b>
 *
 * <p>A record feeds all the later purchase analyses of its edition.
 * Until 2026-08-29, the only way to save one was to analyse a
 * listing, then open the detail of one of its series — and only if
 * the edition was recognised and the volumes were contiguous. The most
 * decisive capability of the app was the most hidden (§16 of the journeys).
 *
 * <p>Worse: when an edition had no record, this block was <b>not shown
 * at all</b>. Nothing said that these prices existed, and that is
 * exactly where one must be able to enter one.
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

/** Opens the form and fills in what is required. */
async function saisirUnPrix(prix: string) {
  await userEvent.click(screen.getByRole('button', { name: /Relever un prix/ }))
  await userEvent.type(screen.getByLabelText(/Prix constaté/), prix)
}

describe('an edition with no record at all', () => {
  it('says that these prices exist, instead of showing nothing', async () => {
    await ecran()

    expect(await screen.findByText(/Aucun prix relevé pour cette édition/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Relever un prix/ })).toBeInTheDocument()
  })
})

describe('recording a price by hand', () => {
  it('sends the price, the platform and the date', async () => {
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    const envoye = api.recordMarketObservation.mock.calls[0][0]
    expect(envoye.mangaEditionId).toBe('ed-1')
    expect(envoye.observedPrice).toBe(45)
    expect(envoye.platform).toBe('VINTED')
    // A record is a DATED fact: the date is always sent, pre-filled with
    // today.
    expect(envoye.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('only sends a range if BOTH bounds are entered', async () => {
    // A half-filled range describes nothing, and the server would silently ignore
    // it - better not to send it.
    await ecran()
    await saisirUnPrix('45')
    await userEvent.type(screen.getByLabelText('Premier tome du lot'), '1')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    const envoye = api.recordMarketObservation.mock.calls[0][0]
    expect(envoye.volumeRangeStart).toBeUndefined()
    expect(envoye.volumeRangeEnd).toBeUndefined()
  })

  it('sends the range when it is complete, and says so before', async () => {
    await ecran()
    await saisirUnPrix('90')
    await userEvent.type(screen.getByLabelText('Premier tome du lot'), '1')
    await userEvent.type(screen.getByLabelText('Dernier tome du lot'), '6')

    // What this price will describe, announced BEFORE saving: without a range it
    // covers the whole edition, which cannot be guessed.
    expect(screen.getByText('Ce prix décrira les tomes 1 à 6.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    const envoye = api.recordMarketObservation.mock.calls[0][0]
    expect(envoye.volumeRangeStart).toBe(1)
    expect(envoye.volumeRangeEnd).toBe(6)
  })

  it('does not invent a condition when none is given', async () => {
    // "Good condition" by default would skew all comparisons in the optimistic
    // direction.
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.recordMarketObservation).toHaveBeenCalled())
    expect(api.recordMarketObservation.mock.calls[0][0].observedCondition).toBeUndefined()
  })

  it('gives up without sending anything', async () => {
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByLabelText(/Prix constaté/)).not.toBeInTheDocument()
    expect(api.recordMarketObservation).not.toHaveBeenCalled()
  })

  it('shows the server refusal as it is', async () => {
    api.recordMarketObservation.mockRejectedValue(new Error('Le prix doit être strictement positif.'))
    await ecran()
    await saisirUnPrix('45')

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Le prix doit être strictement positif.')).toBeInTheDocument()
  })
})
