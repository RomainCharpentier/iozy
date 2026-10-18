/**
 * <b>A type with no known price is not worth "0,00 €".</b> The line used to
 * read "Jeux vidéo : 0,00 € (0/1)": a real zero, to anyone who does not decode
 * the fraction.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CollectionValueSection } from './CollectionValueSection'

const insights = vi.hoisted(() => ({ getCollectionValue: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('the value by type', () => {
  it('says the price is unknown instead of showing zero', async () => {
    insights.getCollectionValue.mockResolvedValue({
      totalKnownValue: 42,
      pricedOwnershipCount: 6,
      totalActiveOwnershipCount: 7,
      byType: [
        { entityTypeLabel: 'Manga', knownValue: 42, pricedCount: 6, totalCount: 6 },
        { entityTypeLabel: 'Jeux vidéo', knownValue: 0, pricedCount: 0, totalCount: 1 },
      ],
    })

    render(<CollectionValueSection />, { wrapper: enrobage })

    expect(await screen.findByText('Jeux vidéo : prix neuf inconnu (1 possession)')).toBeInTheDocument()
    expect(screen.getByText('Manga : 42,00 € (6/6)')).toBeInTheDocument()
    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument()
  })
})
