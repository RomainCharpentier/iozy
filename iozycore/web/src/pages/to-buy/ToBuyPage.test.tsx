/**
 * <b>The "À acheter" page (lot 216), as it reads.</b>
 *
 * The network is simulated, the rest is real (QueryClient, router, toast
 * context). What is checked is the text on screen: the month spent, the
 * budget or its absence, the list, "Je l'ai" that answers at once and can
 * be undone, and the empty states.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ToBuyPage } from './ToBuyPage'
import { ToastContext, type ToastAction } from '@/common/lib/toast'
import type { MonthSpendingDto, ToBuyLineDto } from '@/common/types/api'

const api = vi.hoisted(() => ({
  listToBuy: vi.fn(),
  fetchMonthSpending: vi.fn(),
  setBudget: vi.fn(),
  acquireElement: vi.fn(),
}))
const possessions = vi.hoisted(() => ({ deleteOwnership: vi.fn() }))
const envies = vi.hoisted(() => ({ addToWishlist: vi.fn() }))

vi.mock('@/common/api/purchases', () => api)
vi.mock('@/common/api/ownerships', () => possessions)
vi.mock('@/common/api/wishlist', () => envies)

const messages: { texte: string; action?: ToastAction }[] = []

function mois(patch: Partial<MonthSpendingDto> = {}): MonthSpendingDto {
  return { month: '2026-11', spent: 42.3, pricedCount: 3, unpricedCount: 0, monthlyBudget: 150, ...patch }
}

const FRIEREN: ToBuyLineDto = {
  entityId: 'frieren',
  entityTypeId: 'manga',
  title: 'Frieren',
  coverImageUrl: null,
  kind: 'COMPLETE',
  collectorStatus: 'ONGOING',
  releaseDate: null,
  releasePrecision: null,
  elements: [
    { key: 'volume-11', label: 'Tome 11', number: 11, coverImageUrl: null, state: 'MISSING', releaseDate: null },
    { key: 'volume-12', label: 'Tome 12', number: 12, coverImageUrl: null, state: 'MISSING', releaseDate: null },
  ],
}

const CATAN: ToBuyLineDto = {
  ...FRIEREN,
  entityId: 'catan',
  entityTypeId: 'jeux',
  title: 'Catan : Marins',
  kind: 'WISH',
  elements: [{ key: 'work', label: 'Catan : Marins', number: null, coverImageUrl: null, state: 'WANTED', releaseDate: null }],
}

function afficher(): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  function Enrobage({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastContext.Provider value={(texte, action) => void messages.push({ texte, action })}>
          <MemoryRouter initialEntries={['/to-buy']}>{children}</MemoryRouter>
        </ToastContext.Provider>
      </QueryClientProvider>
    )
  }
  render(
    <Routes>
      <Route path="/to-buy" element={<ToBuyPage />}>
        <Route path="analyse" element={<h2>Analyser une annonce</h2>} />
      </Route>
    </Routes>,
    { wrapper: Enrobage },
  )
}

beforeEach(() => {
  messages.length = 0
  vi.clearAllMocks()
  api.listToBuy.mockResolvedValue([FRIEREN, CATAN])
  api.fetchMonthSpending.mockResolvedValue(mois())
})

describe('the to-buy page', () => {
  it('shows the month spent in a big number, and the budget with what is left', async () => {
    afficher()

    expect(await screen.findByRole('heading', { name: 'Dépensé en novembre' })).toBeInTheDocument()
    expect(screen.getByText(/^42,30\s€$/)).toBeInTheDocument()
    expect(screen.getByText('3 achats')).toBeInTheDocument()
    expect(screen.getByText(/42,30\s€ sur 150,00\s€/)).toBeInTheDocument()
    expect(screen.getByText(/Il te reste 107,70\s€/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /28 % du budget/ })).toBeInTheDocument()
  })

  it('shows no budget when there is none, and offers to set one', async () => {
    api.fetchMonthSpending.mockResolvedValue(mois({ monthlyBudget: null }))
    api.setBudget.mockResolvedValue({ monthlyBudget: 120 })
    afficher()

    expect(await screen.findByText('Pas de budget ce mois-ci.')).toBeInTheDocument()
    expect(screen.queryByText(/sur 150/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fixer un budget' }))
    await userEvent.type(screen.getByLabelText('Budget du mois (€)'), '120')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(api.setBudget).toHaveBeenCalledWith(120))
  })

  it('lists what to buy, each line with what it is and why', async () => {
    afficher()

    expect(await screen.findByText('Frieren, tomes 11 et 12')).toBeInTheDocument()
    expect(screen.getByText('il t’en manque 2')).toBeInTheDocument()
    expect(screen.getByText('Catan : Marins')).toBeInTheDocument()
    expect(screen.getByText('dans tes envies')).toBeInTheDocument()
  })

  it('"Je l\'ai" takes the first element at once, and "Annuler" really undoes it', async () => {
    let repondre: (valeur: unknown) => void = () => {}
    api.acquireElement.mockReturnValue(new Promise((r) => (repondre = r)))
    possessions.deleteOwnership.mockResolvedValue(undefined)
    envies.addToWishlist.mockResolvedValue({})
    afficher()

    await userEvent.click(await screen.findByRole('button', { name: 'Catan : Marins : je l\'ai' }))
    // Before the server answers, the line is gone.
    await waitFor(() => expect(screen.queryByText('Catan : Marins')).not.toBeInTheDocument())
    expect(api.acquireElement).toHaveBeenCalledWith('catan', 'work')

    repondre({ ownershipId: 'o1', entityId: 'catan', variantId: null, wishRemoved: true })
    await waitFor(() => expect(messages.at(-1)?.texte).toBe('Catan : Marins : dans ta collection'))
    messages.at(-1)!.action!.onAction()
    await waitFor(() => expect(envies.addToWishlist).toHaveBeenCalledWith({ entityId: 'catan' }))
    expect(possessions.deleteOwnership).toHaveBeenCalledWith('o1')
  })

  it('keeps the rest of a grouped line after "Je l\'ai"', async () => {
    api.acquireElement.mockReturnValue(new Promise(() => {}))
    afficher()

    await userEvent.click(await screen.findByRole('button', { name: 'Frieren, Tome 11 : je l\'ai' }))
    expect(await screen.findByText('Frieren, tome 12')).toBeInTheDocument()
  })

  it('puts the line back and says why when the server refuses', async () => {
    api.acquireElement.mockRejectedValue(new Error('Tu as déjà « Catan : Marins »'))
    afficher()

    await userEvent.click(await screen.findByRole('button', { name: 'Catan : Marins : je l\'ai' }))
    await waitFor(() => expect(messages.at(-1)?.texte).toBe('Impossible de l\'ajouter : Tu as déjà « Catan : Marins »'))
    expect(await screen.findByText('Catan : Marins')).toBeInTheDocument()
  })

  it('says when there is nothing to buy and nothing bought', async () => {
    api.listToBuy.mockResolvedValue([])
    api.fetchMonthSpending.mockResolvedValue(mois({ spent: 0, pricedCount: 0, monthlyBudget: null }))
    afficher()

    expect(await screen.findByText('Rien à acheter pour l’instant.')).toBeInTheDocument()
    expect(await screen.findByText('Aucun achat noté ce mois-ci')).toBeInTheDocument()
  })

  it('opens the listing analysis in a side panel and closes it', async () => {
    afficher()

    await userEvent.click(await screen.findByRole('link', { name: 'Analyser une annonce' }))
    expect(await screen.findByRole('dialog', { name: 'Analyser une annonce' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fermer l’analyse' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
