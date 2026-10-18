/**
 * <b>An empty answer from BoardGameGeek is said as such.</b> "0 créé(s), 0
 * déjà possédé(s) sur 0 trouvé(s)" read like an import that worked on
 * nothing. An unknown user or a silent BGG is an error from the server, shown
 * as it is.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ImportBggPage } from './ImportBggPage'

const metadata = vi.hoisted(() => ({ importBggCollection: vi.fn() }))
vi.mock('@/common/api/metadata', () => metadata)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

async function importer() {
  render(<ImportBggPage />, { wrapper: enrobage })
  await userEvent.type(screen.getByLabelText('Pseudo BoardGameGeek'), 'quelquun')
  await userEvent.click(screen.getByRole('button', { name: 'Importer' }))
}

describe('the BGG import result', () => {
  it('says BGG found no owned game, without a row of zeros', async () => {
    metadata.importBggCollection.mockResolvedValue({ totalFound: 0, created: 0, matchedExisting: 0, failed: 0 })

    await importer()

    expect(await screen.findByText('BoardGameGeek a répondu : aucun jeu marqué « possédé » sur ce compte.')).toBeInTheDocument()
    expect(screen.queryByText(/0 trouvé/)).not.toBeInTheDocument()
  })

  it('counts what was added, in French', async () => {
    metadata.importBggCollection.mockResolvedValue({ totalFound: 3, created: 2, matchedExisting: 1, failed: 0 })

    await importer()

    expect(
      await screen.findByText('2 jeux ajoutés, 1 déjà présent, sur 3 jeux trouvés sur BoardGameGeek.'),
    ).toBeInTheDocument()
  })

  it('shows the reason given by the server when BGG did not answer', async () => {
    metadata.importBggCollection.mockRejectedValue(new Error("Ce pseudo n'existe pas sur BoardGameGeek."))

    await importer()

    expect(await screen.findByText("Ce pseudo n'existe pas sur BoardGameGeek.")).toBeInTheDocument()
  })
})
