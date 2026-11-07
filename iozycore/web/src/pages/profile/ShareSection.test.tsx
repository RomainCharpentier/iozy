/**
 * The share link: generating or removing it can fail, and the screen must say so.
 * Before, only the section checkboxes reported their errors: a failed
 * "Générer un lien" just went back to its idle label.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ShareSection } from './ShareSection'
import { generateShare, getShare, removeShare } from '@/common/api/share'

vi.mock('@/common/api/share', () => ({
  generateShare: vi.fn(),
  getShare: vi.fn(),
  removeShare: vi.fn(),
  updateShare: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('ShareSection', () => {
  it('shows the error when generating the link fails', async () => {
    vi.mocked(getShare).mockResolvedValue({
      token: null,
      shareCollection: true,
      shareWishlist: true,
      includeTierLists: false,
    })
    vi.mocked(generateShare).mockRejectedValue(new Error('Génération impossible'))
    render(<ShareSection />, { wrapper })

    fireEvent.click(await screen.findByRole('button', { name: 'Générer un lien' }))

    expect(await screen.findByText('Génération impossible')).toBeInTheDocument()
  })

  it('shows the error when removing the link fails', async () => {
    vi.mocked(getShare).mockResolvedValue({
      token: 'abc',
      shareCollection: true,
      shareWishlist: true,
      includeTierLists: false,
    })
    vi.mocked(removeShare).mockRejectedValue(new Error('Désactivation impossible'))
    render(<ShareSection />, { wrapper })

    await screen.findByText(/public\/share\/abc/)
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver le partage' }))

    expect(await screen.findByText('Désactivation impossible')).toBeInTheDocument()
  })
})
