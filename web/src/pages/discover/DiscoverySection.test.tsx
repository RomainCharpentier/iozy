/**
 * <b>An empty list of suggestions never hides a silent source.</b> A provider
 * in outage answers an empty list, exactly like "nothing to offer": the panel
 * said "rien à proposer", and the outage was invisible.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DiscoverySection } from './DiscoverySection'
import { typeDeCollection } from '@/test/fixtures'

const insights = vi.hoisted(() => ({ discover: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)
vi.mock('@/common/api/entityTypes', () => ({
  listEntityTypes: () => Promise.resolve([{ ...typeDeCollection('MANGA', 'Manga'), hasDiscoverySource: true }]),
}))
vi.mock('@/common/api/entities', () => ({ quickAdd: vi.fn() }))

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('the discoveries of a universe', () => {
  it('names the silent source as a possible cause, and offers to try again', async () => {
    insights.discover.mockResolvedValue([])
    render(<DiscoverySection />, { wrapper: enrobage })

    await userEvent.click(await screen.findByRole('button', { name: 'Voir des suggestions' }))

    expect(await screen.findByText(/^Manga : aucune suggestion/)).toHaveTextContent("la source n'a pas répondu")
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(insights.discover).toHaveBeenCalledTimes(2)
  })
})
