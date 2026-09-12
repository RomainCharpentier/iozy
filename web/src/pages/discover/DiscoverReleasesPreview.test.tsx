/**
 * <b>Les prochaines sorties, en tête de Découvrir.</b> Trois lignes au plus,
 * datées, sur les trois mois à venir - et « Tout voir » vers le calendrier.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DiscoverReleasesPreview } from './DiscoverReleasesPreview'
import { typeDeCollection } from '@/test/fixtures'
import type { ReleaseEntryDto } from '@/common/types/api'

const insights = vi.hoisted(() => ({ getReleaseCalendar: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)
const types = vi.hoisted(() => ({ listEntityTypes: vi.fn() }))
vi.mock('@/common/api/entityTypes', () => types)

const JEU = { ...typeDeCollection('VIDEO_GAME', 'Jeu vidéo'), hasReleaseSource: true }

function sortie(entityTitle: string, date: string): ReleaseEntryDto {
  return {
    date,
    precision: 'DAY',
    entityId: entityTitle,
    entityTitle,
    entityTypeId: JEU.id,
    label: '',
    volumeNumber: null,
    editionName: null,
    coverImageUrl: null,
    relation: 'WANTED',
    source: 'IGDB',
  }
}

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  types.listEntityTypes.mockResolvedValue([JEU])
})

describe('DiscoverReleasesPreview', () => {
  it('montre les trois premières sorties, datées, et mène au calendrier', async () => {
    insights.getReleaseCalendar.mockResolvedValue({
      from: '',
      to: '',
      entries: [sortie('Silksong', '2026-11-14'), sortie('Tunic 2', '2026-11-20'), sortie('Trois', '2026-12-01'), sortie('Quatre', '2026-12-02')],
    })
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByRole('link', { name: /14 nov\..*Silksong.*Jeu vidéo.*Envie/ })).toHaveAttribute('href', '/entity/Silksong')
    expect(screen.getByRole('link', { name: /Tunic 2/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Trois/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Quatre/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tout voir' })).toHaveAttribute('href', '/releases')

    const [from, to] = insights.getReleaseCalendar.mock.calls[0]
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to > from).toBe(true)
  })

  it('dit quand rien n’est annoncé, et comment suivre une œuvre', async () => {
    insights.getReleaseCalendar.mockResolvedValue({ from: '', to: '', entries: [] })
    render(<DiscoverReleasesPreview />, { wrapper: enrobage })

    expect(await screen.findByText("Rien d'annoncé pour les trois prochains mois.")).toBeInTheDocument()
    expect(screen.getByText("Suis une œuvre depuis sa fiche pour voir ses sorties ici.")).toBeInTheDocument()
  })
})
