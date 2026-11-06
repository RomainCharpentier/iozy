/**
 * <b>The shelf page holds everything a room leaves out.</b>
 * A room stops at about ten works: if this page stopped too, the others could
 * no longer be reached at all.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryPage } from './CategoryPage'
import { oeuvre, possession, typeDeCollection } from '@/test/fixtures'

vi.mock('@/common/api/tags', () => ({ listTags: vi.fn().mockResolvedValue([]) }))
const donnees = vi.hoisted(() => ({ useDonneesCollection: vi.fn() }))
vi.mock('@/pages/collection/useDonneesCollection', () => donnees)

const JEU = typeDeCollection('VIDEO_GAME', 'Jeu vidéo')
const JEUX = Array.from({ length: 14 }, (_, i) => oeuvre({ titre: `Jeu ${String(i).padStart(2, '0')}`, typeId: JEU.id }))

function enrobage({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/collection/${JEU.id}`]}>
        <Routes>
          <Route path="/collection/:entityTypeId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  donnees.useDonneesCollection.mockReturnValue({
    entities: JEUX,
    entityTypes: [JEU],
    ownerships: JEUX.map((jeu) => possession({ entityId: jeu.id })),
    progression: new Map(),
    owned: new Set<string>(),
    oeuvresVoulues: new Set<string>(),
    oeuvresSuivies: new Set<string>(),
    tomesVoulus: new Set<string>(),
    wishlist: { entries: [], variantsVoulus: new Set<string>(), isLoading: false },
    chargement: false,
    listeChargee: true,
    erreurs: [],
  })
})

describe('the shelf page of a category', () => {
  it('shows every work, in the arrangement of the room', () => {
    render(<CategoryPage />, { wrapper: enrobage })

    expect(screen.getAllByRole('button', { name: /^Jeu \d+/ })).toHaveLength(14)
    expect(screen.getByRole('heading', { name: 'Console à préciser' })).toBeInTheDocument()
  })

  it('offers the same view as the room', () => {
    render(<CategoryPage />, { wrapper: enrobage })

    expect(screen.getByRole('radio', { name: 'Compact' })).toBeInTheDocument()
  })
})
