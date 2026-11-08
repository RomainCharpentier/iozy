/**
 * The listing link: a transport failure (5xx, offline) used to leave the field
 * showing the idle "Détection" line, and nothing ever called the server again
 * for the same link. It must now say so and offer a retry.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ListingUrlField } from './ListingUrlField'
import { resolveListing } from '@/common/api/purchaseAnalysis'
import type { ListingPreviewDto } from '@/common/types/purchaseAnalysis'

vi.mock('@/common/api/purchaseAnalysis', () => ({ resolveListing: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const URL = 'https://www.vinted.fr/items/123'

beforeEach(() => vi.clearAllMocks())

describe('ListingUrlField', () => {
  it('says the reading failed and retries on demand', async () => {
    vi.mocked(resolveListing).mockRejectedValueOnce(new Error('Failed to fetch'))
    vi.mocked(resolveListing).mockResolvedValueOnce({
      status: 'UNSUPPORTED_SOURCE',
      source: 'VINTED',
      retrievedFields: [],
      imageUrls: [],
    } as unknown as ListingPreviewDto)
    const onResolved = vi.fn(() => ({ conserves: [] }))
    render(<ListingUrlField url={URL} onUrlChange={vi.fn()} onResolved={onResolved} />, { wrapper })

    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent(
      'Impossible de récupérer automatiquement cette annonce',
    )
    expect(screen.queryByText(/Détection/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText(/pas encore récupérée automatiquement/)).toBeInTheDocument()
    expect(resolveListing).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })
})
