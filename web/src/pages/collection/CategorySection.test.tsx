/**
 * <b>Un rail est un aperçu, pas la liste entière.</b>
 *
 * Mesuré sur 300 séries (lot 141) : le rail rendait toutes ses tuiles dans un
 * défilement horizontal que personne ne parcourt, et dégroupé ses 3 000 tomes.
 * Il en montre un nombre borné ; le compte, lui, dit toujours le total, et
 * « Tout voir » mène au rayon complet.
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

describe('le rail', () => {
  it('borne les tuiles rendues, et compte quand même tout', () => {
    render(
      <MemoryRouter>
        <CategorySection entityType={typeDeCollection('MANGA', 'Manga')} tiles={tuiles(300)} />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: /^Série \d{3}/ })).toHaveLength(TUILES_PAR_RAIL)
    // L'en-tête du rail : le libellé, le TOTAL, et la porte vers le rayon.
    expect(screen.getByRole('button', { name: /Manga.*300.*Tout voir/ })).toBeInTheDocument()
  })

  it('montre tout quand il y a moins que la borne', () => {
    render(
      <MemoryRouter>
        <CategorySection entityType={typeDeCollection('MANGA', 'Manga')} tiles={tuiles(5)} />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: /^Série \d{3}/ })).toHaveLength(5)
  })
})
