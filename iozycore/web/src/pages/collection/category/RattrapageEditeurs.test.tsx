/**
 * <b>Completing the publishers never overwrites, and stops on a silence.</b>
 * The tool writes on a shared catalogue: it only fills what is empty, and a
 * source that stops answering must not make the rest look done.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RattrapageEditeurs } from './RattrapageEditeurs'
import { oeuvre } from '@/test/fixtures'
import type { EntityResponse } from '@/common/types/api'

const entites = vi.hoisted(() => ({ mergeEntityAttributes: vi.fn() }))
const metadonnees = vi.hoisted(() => ({ detailsOeuvre: vi.fn() }))
vi.mock('@/common/api/entities', () => entites)
vi.mock('@/common/api/metadata', () => metadonnees)

function enrobage({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

function jeu(titre: string, attributes: Record<string, unknown>): EntityResponse {
  return { ...oeuvre({ titre }), attributes }
}

beforeEach(() => vi.clearAllMocks())

describe('the publishers tool', () => {
  it('writes what is missing as a source, and leaves what the work already has', async () => {
    metadonnees.detailsOeuvre.mockResolvedValue({ publisher: 'Nintendo', platforms: 'Switch', coverImageUrl: 'x.jpg' })
    entites.mergeEntityAttributes.mockResolvedValue({})
    render(
      <RattrapageEditeurs oeuvresPossedees={[jeu('Zelda', { igdbId: '1', platforms: 'Saisie à la main' })]} entityTypeId="t" />,
      { wrapper: enrobage },
    )

    await userEvent.click(screen.getByRole('button', { name: /Compléter les éditeurs/ }))

    expect(await screen.findByText('1 œuvre complétée.')).toBeInTheDocument()
    expect(entites.mergeEntityAttributes).toHaveBeenCalledWith(expect.any(String), { publisher: 'Nintendo' }, 'source')
  })

  it('says it stopped when the source goes silent', async () => {
    metadonnees.detailsOeuvre.mockRejectedValue(new Error('503'))
    render(
      <RattrapageEditeurs oeuvresPossedees={[jeu('A', { bggId: '1' }), jeu('B', { bggId: '2' })]} entityTypeId="t" />,
      { wrapper: enrobage },
    )

    await userEvent.click(screen.getByRole('button', { name: /Compléter les éditeurs/ }))

    expect(await screen.findByText(/Le fournisseur n'a plus répondu/)).toBeInTheDocument()
    expect(metadonnees.detailsOeuvre).toHaveBeenCalledTimes(1)
  })

  it('does not offer anything for a work without a source, or already complete', () => {
    render(
      <RattrapageEditeurs
        oeuvresPossedees={[jeu('A la main', {}), jeu('Complet', { bggId: '1', publisher: 'KOSMOS' })]}
        entityTypeId="t"
      />,
      { wrapper: enrobage },
    )

    expect(screen.queryByRole('button', { name: /Compléter les éditeurs/ })).not.toBeInTheDocument()
  })
})
