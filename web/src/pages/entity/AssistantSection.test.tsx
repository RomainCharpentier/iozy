/**
 * <b>The help never contradicts the page it sits on.</b>
 *
 * <p>The grid said "Manquants 2" while the help answered that it could not
 * tell what was missing - two truths on one screen. And a visitor was asked
 * "Que me manque-t-il ?", about a collection they do not have.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ReponseAssistant, ReponseCatalogue } from './AssistantSection'
import type { EditionProgressDto, ExperienceResponse } from '@/common/types/api'

const completude = vi.hoisted(() => ({ getCompleteness: vi.fn() }))
vi.mock('@/common/api/purchaseAnalysis', () => completude)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const GLENAT = {
  editionName: 'Glénat',
  totalVolumes: null,
  ownedVolumeNumbers: [],
  cataloguedVolumeNumbers: [1, 2],
  sourceEditions: ['Glénat'],
} as unknown as EditionProgressDto

describe('"Que me manque-t-il ?" with an unknown total', () => {
  it('names the same missing volumes as the grid', async () => {
    completude.getCompleteness.mockResolvedValue({
      totalVolumes: null,
      missingVolumeNumbers: [],
      cataloguedMissingVolumeNumbers: [],
      estimatedCostToComplete: null,
      costToCompleteBasis: null,
    })
    render(
      <ReponseAssistant
        entityId="e1"
        entityTitle="ONE PIECE episode A"
        variants={[]}
        experiences={[]}
        activeGroup={GLENAT}
        missingKnownVolumes={[1, 2]}
        question="missing"
      />,
      { wrapper: enrobage },
    )

    expect(await screen.findByText(/il te manque/)).toHaveTextContent('il te manque 2 tomes : 1 à 2.')
    expect(screen.queryByText(/je ne peux pas dire ce qui manque/)).not.toBeInTheDocument()
  })
})

describe('the help of a visitor', () => {
  const base = {
    editionName: 'Glénat',
    totalVolumes: null,
    shownVolumes: [1, 2],
    editions: [{ nom: 'Glénat', editeur: null, total: null }],
    seriesStatus: 'Terminée',
    ongoing: false,
    years: '2020',
    creator: 'Boichi',
    creatorLabel: 'Mangaka',
  }

  it('answers about the edition without speaking of a collection', () => {
    render(<ReponseCatalogue {...base} question="volumes" />)

    expect(screen.getByText("Le nombre total de tomes de l'édition « Glénat » n'est pas connu.")).toBeInTheDocument()
    expect(screen.getByText('Le catalogue en décrit 2 : tomes 1 à 2.')).toBeInTheDocument()
    expect(screen.queryByText(/manque|ta collection|tes /)).not.toBeInTheDocument()
  })

  it('answers the publication status from the source', () => {
    render(<ReponseCatalogue {...base} question="status" />)

    expect(screen.getByText('Oui, la série est terminée (2020).')).toBeInTheDocument()
  })
})

describe('"Où en suis-je ?"', () => {
  function lecture(id: string, rating: number | null): ExperienceResponse {
    return { id, entityId: 'e1', variantId: null, experienceType: 'READ', occurredAt: '2026-10-01', rating, comment: null }
  }

  function rendre(experiences: ExperienceResponse[]) {
    render(
      <ReponseAssistant
        entityId="e1"
        entityTitle="Blue Lock"
        variants={[]}
        experiences={experiences}
        activeGroup={GLENAT}
        missingKnownVolumes={[]}
        question="reading"
      />,
      { wrapper: enrobage },
    )
  }

  it('points to the place where a reading is added today', () => {
    // "Mon suivi" and its "Expériences" entry are gone: readings are added
    // under the single "Éditer" of the page.
    rendre([])

    expect(screen.getByText(/Aucune lecture enregistrée/)).toHaveTextContent(
      'Tu peux en ajouter une avec « Éditer », en haut de la fiche.',
    )
    expect(screen.queryByText(/Mon suivi/)).not.toBeInTheDocument()
  })

  it('writes the average rating with a decimal comma', () => {
    rendre([lecture('x1', 7), lecture('x2', 8)])

    expect(screen.getByText(/Note moyenne/)).toHaveTextContent('Note moyenne : 7,5/10 sur 2 lectures notées.')
  })
})
