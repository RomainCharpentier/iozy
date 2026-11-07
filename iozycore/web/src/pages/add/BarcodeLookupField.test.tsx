/**
 * The barcode lookup: a 404 means "nothing found", but any other failure
 * (a 503 when a metadata source did not answer) must be said, with a hint to retry.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { BarcodeLookupField } from './BarcodeLookupField'
import { lookupBarcode } from '@/common/api/metadata'
import { ApiError } from '@/common/api/client'

vi.mock('@/common/api/metadata', () => ({ lookupBarcode: vi.fn() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function searchFor(code: string) {
  render(<BarcodeLookupField entityTypeId="manga" onFound={vi.fn()} />, { wrapper })
  fireEvent.change(screen.getByLabelText('Code-barres / ISBN'), { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
}

beforeEach(() => vi.clearAllMocks())

describe('BarcodeLookupField', () => {
  it('says the source is unavailable on a 503', async () => {
    vi.mocked(lookupBarcode).mockRejectedValue(new ApiError(503, 'Service Unavailable'))
    searchFor('9782723492607')

    expect(await screen.findByRole('alert')).toHaveTextContent('Source indisponible')
  })

  it('says the lookup failed on any other error', async () => {
    vi.mocked(lookupBarcode).mockRejectedValue(new Error('Failed to fetch'))
    searchFor('9782723492607')

    expect(await screen.findByRole('alert')).toHaveTextContent('La recherche a échoué')
  })

  it('keeps a 404 as "nothing found", not an error', async () => {
    vi.mocked(lookupBarcode).mockResolvedValue(null)
    searchFor('9782723492607')

    expect(await screen.findByText(/Aucune correspondance/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
