/**
 * <b>A rail is a preview, not the whole list.</b>
 *
 * Measured on 300 series (batch 141): the rail rendered all its tiles in a
 * horizontal scroll that nobody goes through, and ungrouped its 3,000 volumes.
 * It shows a limited number; the count, for its part, always says the total, and
 * "Tout voir" leads to the full shelf.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CategorySection, TUILES_PAR_RAIL } from './CategorySection'
import type { ShelfTile } from './shelfTiles'
import { typeDeCollection } from '@/test/fixtures'

function tuiles(n: number): ShelfTile[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `t${i}`,
    title: `Série ${String(i + 1).padStart(3, '0')}`,
    subtitle: '1/10 tomes',
    imageUrl: null,
    entityId: `e${i}`,
  }))
}

describe('the rail', () => {
  it('limits the rendered tiles, and still counts everything', () => {
    render(
      <MemoryRouter>
        <CategorySection entityType={typeDeCollection('MANGA', 'Manga')} tiles={tuiles(300)} />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: /^Série \d{3}/ })).toHaveLength(TUILES_PAR_RAIL)
    // The rail header: the label, the TOTAL, and the door to the shelf.
    expect(screen.getByRole('button', { name: /Manga.*300.*Tout voir/ })).toBeInTheDocument()
  })

  it('shows everything when there are fewer than the limit', () => {
    render(
      <MemoryRouter>
        <CategorySection entityType={typeDeCollection('MANGA', 'Manga')} tiles={tuiles(5)} />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: /^Série \d{3}/ })).toHaveLength(5)
  })
})
