/**
 * <b>Everything that is coming, month by month.</b> What breaks silently: a
 * window that goes past the year the server accepts, a month that goes
 * ahead of another, a release "à préciser" that climbs before the known
 * days, a row that no longer brings the grid to the right place.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ListeAVenir } from './ListeAVenir'
import { isoLocal } from '@/common/lib/releaseDate'
import type { ReleaseEntryDto } from '@/common/types/api'

const insights = vi.hoisted(() => ({ getReleaseCalendar: vi.fn() }))
vi.mock('@/common/api/insights', () => insights)

function sortie(surcharges: Partial<ReleaseEntryDto>): ReleaseEntryDto {
  return {
    date: '2000-03-19',
    precision: 'DAY',
    entityId: 'naruto',
    entityTitle: 'Naruto',
    entityTypeId: 'manga',
    label: 'Tome 73 · Kana',
    volumeNumber: 73,
    editionName: 'Kana',
    coverImageUrl: null,
    relation: 'MISSING',
    source: 'GOOGLE_BOOKS',
    ...surcharges,
  }
}

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const TYPES = new Map([['jeu', 'Jeu vidéo']])

beforeEach(() => vi.clearAllMocks())

describe('ListeAVenir', () => {
  it('asks for the coming year, lays it out month by month, and each row brings the grid to its day', async () => {
    insights.getReleaseCalendar.mockResolvedValue({
      from: '',
      to: '',
      entries: [
        sortie({ date: '2000-03-19', entityId: 'gta', entityTitle: 'GTA VI', label: '', entityTypeId: 'jeu', relation: 'WANTED', source: 'IGDB' }),
        sortie({ date: '2000-02', precision: 'MONTH', entityId: 'spy', entityTitle: 'Spy x Family', label: 'Tome 16 · Kurokawa' }),
        sortie({ date: '2000-02-03', entityId: 'naruto-73' }),
      ],
    })
    const onVoir = vi.fn()
    render(<ListeAVenir libelleParType={TYPES} onVoir={onVoir} />, { wrapper: enrobage })
    const utilisateur = userEvent.setup()

    expect(await screen.findByRole('complementary', { name: 'À venir' })).toBeInTheDocument()
    // From today to the eve of the same day next year: never 366 days.
    const [from, to] = insights.getReleaseCalendar.mock.calls[0]
    const aujourdHui = new Date()
    expect(from).toBe(isoLocal(aujourdHui))
    expect(to).toBe(isoLocal(new Date(aujourdHui.getFullYear() + 1, aujourdHui.getMonth(), aujourdHui.getDate() - 1)))

    expect((await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent)).toEqual(['Février 2000', 'Mars 2000'])
    const lignes = screen.getAllByRole('button').map((b) => b.textContent)
    expect(lignes[0]).toMatch(/3 févr\..*Naruto.*Tome 73 · Kana.*À acheter/)
    expect(lignes[1]).toMatch(/à préciser.*Spy x Family/)
    expect(lignes[2]).toMatch(/19 mars.*GTA VI.*Jeu vidéo.*Envie/)

    await utilisateur.click(screen.getByRole('button', { name: /GTA VI/ }))
    expect(onVoir).toHaveBeenCalledWith('2000-03', '2000-03-19')
    await utilisateur.click(screen.getByRole('button', { name: /Spy x Family/ }))
    expect(onVoir).toHaveBeenCalledWith('2000-02', null)
  })

  it('says when the coming year is empty', async () => {
    insights.getReleaseCalendar.mockResolvedValue({ from: '', to: '', entries: [] })
    render(<ListeAVenir libelleParType={TYPES} onVoir={vi.fn()} />, { wrapper: enrobage })

    expect(await screen.findByText("Rien d'annoncé pour l'année qui vient.")).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
