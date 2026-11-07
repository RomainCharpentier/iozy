/**
 * The yearly recap card writes white text on a colored gradient. Its small
 * labels were white at 85% opacity, which fell under 4.5:1 on four of the six
 * gradients. `check:contrast` proves that plain white passes on every first
 * stop; this test proves that the card really uses plain white.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CollectionRecapPage } from './CollectionRecapPage'

vi.mock('@/common/api/insights', () => ({
  getYearlyRecap: vi.fn().mockResolvedValue({
    year: 2026,
    acquisitionsCount: 12,
    acquisitionsByType: [
      { entityTypeLabel: 'Manga', count: 8 },
      { entityTypeLabel: 'Livre', count: 4 },
    ],
    seriesStartedCount: 3,
    experiencesCount: 5,
    averageRating: 7.5,
    mostFeaturedCreator: 'Oda',
    mostFeaturedCreatorCount: 4,
    availableYears: [2026],
  }),
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CollectionRecapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CollectionRecapPage', () => {
  it('writes every label of the card in plain white, never in see-through white', async () => {
    const { container } = renderPage()
    await screen.findByText('ajouts à la collection')

    const card = screen.getByText(/^Bilan de collection/).parentElement as HTMLElement
    const texts = Array.from(card.querySelectorAll('p, span'))
    expect(texts.length).toBeGreaterThan(5)
    for (const text of texts) {
      expect(text.className).not.toMatch(/text-white\//)
      expect(text.className).not.toMatch(/opacity-/)
    }
    expect(container.innerHTML).not.toMatch(/text-white\/\d/)
  })

  it('draws every text of the exported image in plain white', async () => {
    // jsdom does not draw on a canvas: record the fill color of each text.
    const fills: string[] = []
    const ctx = {
      fillStyle: '' as unknown,
      font: '',
      textBaseline: '',
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      fillRect: vi.fn(),
      measureText: () => ({ width: 100 }),
      fillText(this: { fillStyle: unknown }) {
        fills.push(String(this.fillStyle))
      },
    }
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    try {
      renderPage()
      fireEvent.click(await screen.findByRole('button', { name: /Télécharger l'image/ }))

      expect(fills.length).toBeGreaterThan(5)
      for (const fill of fills) {
        expect(fill.toLowerCase()).toBe('#ffffff')
      }
    } finally {
      getContext.mockRestore()
      toDataURL.mockRestore()
      click.mockRestore()
    }
  })
})
