/**
 * <b>"Mes classements" never hides a failure.</b> A failed load used to say
 * "Cette œuvre n'est classée nulle part.", and a failed rank left the picker
 * open with no word.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TierSummarySection } from './TierSummarySection'

const tierLists = vi.hoisted(() => ({ getEntityTierSummary: vi.fn(), setGeneralRank: vi.fn() }))
vi.mock('@/common/api/tierLists', () => tierLists)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderSection() {
  render(<TierSummarySection entityId="e1" entityTitle="Berserk" entityTypeLabel="Manga" coverImageUrl={null} />, {
    wrapper,
  })
}

describe('the tier summary of a work', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows the load error instead of saying the work is ranked nowhere', async () => {
    tierLists.getEntityTierSummary.mockRejectedValue(new Error('Serveur injoignable'))
    renderSection()

    expect(await screen.findByText('Classements indisponibles : Serveur injoignable')).toBeInTheDocument()
    expect(screen.queryByText("Cette œuvre n'est classée nulle part.")).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Classer cette œuvre/ })).not.toBeInTheDocument()
  })

  it('shows a failed rank inside the picker, which stays open', async () => {
    tierLists.getEntityTierSummary.mockResolvedValue({ generalRank: null, customRanks: [] })
    tierLists.setGeneralRank.mockRejectedValue(new Error('Classement refusé'))
    renderSection()

    await userEvent.click(await screen.findByRole('button', { name: /Classer cette œuvre/ }))
    await userEvent.click(screen.getByRole('button', { name: 'S' }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Classement refusé')).toBeInTheDocument()
  })
})
