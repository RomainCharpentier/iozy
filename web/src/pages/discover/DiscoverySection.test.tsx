/**
 * <b>An empty list of suggestions never hides a silent source, and never
 * invents one.</b> The panel used to say "rien à proposer" during an outage,
 * then named both causes at once (batch 158). Now the server says which one it
 * is (batch 159), and the panel says only that one.
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
  it('says the source did not answer, and offers to try again', async () => {
    insights.discover.mockResolvedValue({ candidates: [], sourceAnswered: false, emptyReason: null })
    render(<DiscoverySection />, { wrapper: enrobage })

    await userEvent.click(await screen.findByRole('button', { name: 'Voir des suggestions' }))

    expect(await screen.findByText(/^Manga : la source n'a pas répondu/)).toBeInTheDocument()
    expect(screen.queryByText(/rien à proposer/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(insights.discover).toHaveBeenCalledTimes(2)
  })

  it('says there is nothing to offer, with the reason, and no outage', async () => {
    insights.discover.mockResolvedValue({ candidates: [], sourceAnswered: true, emptyReason: 'NO_RATED_WORK' })
    render(<DiscoverySection />, { wrapper: enrobage })

    await userEvent.click(await screen.findByRole('button', { name: 'Voir des suggestions' }))

    expect(await screen.findByText(/^Manga : rien à proposer/)).toHaveTextContent('Aucune œuvre notée')
    expect(screen.queryByText(/n'a pas répondu/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('says a list is incomplete when part of the source was silent', async () => {
    insights.discover.mockResolvedValue({
      candidates: [{ source: 'JIKAN', externalId: '2', title: 'Bakuman', imageUrl: null, reason: 'Même auteur : Ohba' }],
      sourceAnswered: false,
      emptyReason: null,
    })
    render(<DiscoverySection />, { wrapper: enrobage })

    await userEvent.click(await screen.findByRole('button', { name: 'Voir des suggestions' }))

    expect(await screen.findByText('Bakuman')).toBeInTheDocument()
    expect(screen.getByText(/Liste incomplète/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
