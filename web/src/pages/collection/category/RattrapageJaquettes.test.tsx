/**
 * <b>When the provider goes silent, the count says how far the run went.</b>
 * It used to say "9/9 séries traitées, réessaie plus tard pour les autres":
 * every series done, and others left to do, in the same sentence.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RattrapageJaquettes } from './RattrapageJaquettes'
import { oeuvre } from '@/test/fixtures'

const backfill = vi.hoisted(() => ({ rattraperJaquettes: vi.fn(), variantsMissingCover: vi.fn() }))
vi.mock('@/common/lib/backfillCovers', () => backfill)
vi.mock('@/common/api/entities', () => ({ mergeVariantAttributes: vi.fn() }))
vi.mock('@/common/api/metadata', () => ({ searchVolumes: vi.fn() }))

function enrobage({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

async function lancer(reponses: { trouvees: number; fournisseurMuet: boolean }[]) {
  backfill.variantsMissingCover.mockReturnValue([{}])
  for (const reponse of reponses) backfill.rattraperJaquettes.mockResolvedValueOnce(reponse)
  const oeuvres = [1, 2, 3].map((n) => oeuvre({ titre: `Série ${n}` }))
  render(<RattrapageJaquettes oeuvresPossedees={oeuvres} mangaTypeId="manga" />, { wrapper: enrobage })
  await userEvent.click(screen.getByRole('button', { name: /Retrouver les jaquettes manquantes/ }))
}

describe('the missing covers tool', () => {
  it('counts only the series done before the provider went silent', async () => {
    await lancer([
      { trouvees: 2, fournisseurMuet: false },
      { trouvees: 0, fournisseurMuet: true },
    ])

    expect(
      await screen.findByText(/2 jaquettes retrouvées/),
    ).toHaveTextContent('Le fournisseur a cessé de répondre après 1 série sur 3 : réessaie plus tard pour les 2 autres.')
    expect(screen.queryByText(/3\/3/)).not.toBeInTheDocument()
  })

  it('says nothing was done when the provider is silent from the start', async () => {
    await lancer([{ trouvees: 0, fournisseurMuet: true }])

    expect(await screen.findByText(/Aucune jaquette retrouvée/)).toHaveTextContent(
      "Le fournisseur n'a pas répondu : aucune série traitée, réessaie plus tard.",
    )
  })
})
