/**
 * <b>A failed timeline load is not an empty timeline.</b> The section used to
 * vanish on error, as if no volume had ever been added.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CollectionTimelineSection } from './CollectionTimelineSection'

const insights = vi.hoisted(() => ({ getTimeline: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('the collection timeline', () => {
  it('shows an error when the load fails', async () => {
    insights.getTimeline.mockRejectedValue(new Error('Serveur injoignable'))

    render(<CollectionTimelineSection />, { wrapper })

    expect(await screen.findByText('Évolution indisponible : Serveur injoignable')).toBeInTheDocument()
    expect(screen.getByText('Évolution de ma collection')).toBeInTheDocument()
  })

  it('stays hidden when nothing was ever added', async () => {
    insights.getTimeline.mockResolvedValue([])

    const { container } = render(<CollectionTimelineSection />, { wrapper })

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
