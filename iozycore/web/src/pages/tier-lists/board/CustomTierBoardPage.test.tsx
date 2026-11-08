/**
 * <b>A custom Tier List says when a gesture fails.</b> Ranking, removing a
 * work and deleting the list used to fail without a word, while the general
 * board already showed its error.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TierListDetailDto } from '@/common/types/tierList'
import { CustomTierBoardPage } from './CustomTierBoardPage'

const tierLists = vi.hoisted(() => ({
  addTierListItems: vi.fn(),
  deleteTierList: vi.fn(),
  getTierListDetail: vi.fn(),
  removeTierListItem: vi.fn(),
  setTierListItemRank: vi.fn(),
  updateTierList: vi.fn(),
}))
vi.mock('@/common/api/tierLists', () => tierLists)

const DETAIL: TierListDetailDto = {
  list: {
    id: 't1',
    name: 'Mes seinen',
    entityTypeId: 'manga',
    activeRanks: ['S', 'A', 'B', 'C'],
    description: null,
    createdAt: '2026-01-01T00:00:00Z',
    itemCount: 1,
    rankedCount: 0,
  },
  ranked: [],
  unranked: [{ entityId: 'e1', title: 'Berserk', coverImageUrl: null, rank: null }],
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/tier-lists/t1']}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
  render(
    <Routes>
      <Route path="/tier-lists/:id" element={<CustomTierBoardPage />} />
    </Routes>,
    { wrapper },
  )
}

async function openPicker() {
  await userEvent.click(await screen.findByRole('button', { name: 'Berserk, non classée' }))
  return screen.getByRole('dialog')
}

describe('the custom Tier List board', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    tierLists.getTierListDetail.mockResolvedValue(DETAIL)
  })

  it('shows a failed rank inside the picker', async () => {
    tierLists.setTierListItemRank.mockRejectedValue(new Error('Classement refusé'))
    renderPage()

    const dialog = await openPicker()
    await userEvent.click(within(dialog).getByRole('button', { name: 'S' }))

    expect(await within(dialog).findByText('Classement refusé')).toBeInTheDocument()
  })

  it('shows a failed removal inside the picker', async () => {
    tierLists.removeTierListItem.mockRejectedValue(new Error('Retrait refusé'))
    renderPage()

    const dialog = await openPicker()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retirer de cette Tier List' }))

    expect(await within(dialog).findByText('Retrait refusé')).toBeInTheDocument()
  })

  it('forgets the error of a closed picker', async () => {
    tierLists.setTierListItemRank.mockRejectedValue(new Error('Classement refusé'))
    renderPage()

    const dialog = await openPicker()
    await userEvent.click(within(dialog).getByRole('button', { name: 'S' }))
    await within(dialog).findByText('Classement refusé')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    expect(screen.queryByText('Classement refusé')).not.toBeInTheDocument()
    await openPicker()
    expect(screen.queryByText('Classement refusé')).not.toBeInTheDocument()
  })

  it('forgets the error of a skipped work in quick ranking', async () => {
    tierLists.getTierListDetail.mockResolvedValue({
      ...DETAIL,
      unranked: [...DETAIL.unranked, { entityId: 'e2', title: 'Vagabond', coverImageUrl: null, rank: null }],
    })
    tierLists.setTierListItemRank.mockRejectedValue(new Error('Classement refusé'))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Classer rapidement/ }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'S' }))
    await within(dialog).findByText('Classement refusé')
    await userEvent.click(within(dialog).getByRole('button', { name: /Passer cette œuvre/ }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Vagabond')
    expect(screen.queryByText('Classement refusé')).not.toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Passer cette œuvre/ }))
    expect(screen.queryByText('Classement refusé')).not.toBeInTheDocument()
  })

  it('shows a failed delete inside the confirmation', async () => {
    tierLists.deleteTierList.mockRejectedValue(new Error('Suppression refusée'))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'Menu de la Tier List' }))
    await userEvent.click(screen.getByRole('button', { name: /Supprimer cette Tier List/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer' }))

    const menu = screen.getByRole('dialog', { name: 'Menu de la Tier List' })
    expect(await within(menu).findByText('Suppression refusée')).toBeInTheDocument()
  })
})
