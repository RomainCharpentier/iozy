/**
 * <b>The hero never passes the shared catalog off as this account's titles.</b>
 * The catalog of works is shared by every account of the instance: its size
 * next to "my" value read as the number of titles I own (14 here, 13 in Ma
 * collection).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileValueHero } from './ProfileValueHero'

const insights = vi.hoisted(() => ({ getCollectionValue: vi.fn(), getStats: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('the value hero of Profil', () => {
  it('names the catalog count as the catalog, never as my titles', async () => {
    insights.getCollectionValue.mockResolvedValue({
      totalKnownValue: 50,
      pricedOwnershipCount: 6,
      totalActiveOwnershipCount: 6,
      byType: [],
    })
    insights.getStats.mockResolvedValue({
      totalEntities: 14,
      totalActiveOwnerships: 6,
      wishlistCount: 0,
      experiencesThisYear: 0,
      byType: [],
      topTags: [],
    })

    render(<ProfileValueHero />, { wrapper: enrobage })

    expect(await screen.findByText('Œuvres au catalogue')).toBeInTheDocument()
    expect(screen.queryByText('Titres')).not.toBeInTheDocument()
  })
})
