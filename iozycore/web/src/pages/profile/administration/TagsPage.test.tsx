/**
 * <b>Cleaning up the labels.</b>
 *
 * <p>One could create a tag, attach it, then filter on it - but never
 * rename or delete it. Two rules carry the whole screen, and neither
 * breaks loudly:
 * <ul>
 *   <li>the <b>count</b> says what a deletion will detach. Deleting a
 *       tag set on 12 works and deleting a tag that is useless are not
 *       the same gesture;</li>
 *   <li><b>renaming is not deleting</b>: the tag keeps its identity, only
 *       its name changes - on all the works at once.</li>
 * </ul>
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { TagsPage } from './TagsPage'
import { oeuvre } from '@/test/fixtures'

const apiTags = vi.hoisted(() => ({
  listTags: vi.fn(),
  renommerTag: vi.fn(),
  supprimerTag: vi.fn(),
  createTag: vi.fn(),
  attachTag: vi.fn(),
  detachTag: vi.fn(),
}))
vi.mock('@/common/api/tags', () => apiTags)

const apiEntities = vi.hoisted(() => ({ searchEntities: vi.fn() }))
vi.mock('@/common/api/entities', () => apiEntities)

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
  apiTags.listTags.mockResolvedValue([
    { id: 'tag-seinen', label: 'seinen' },
    { id: 'tag-orphelin', label: 'orphelin' },
  ])
  apiEntities.searchEntities.mockResolvedValue([
    oeuvre({ titre: 'Berserk', tags: ['tag-seinen'] }),
    oeuvre({ titre: 'Vagabond', tags: ['tag-seinen'] }),
  ])
  apiTags.renommerTag.mockResolvedValue({ id: 'tag-seinen', label: 'seinen' })
  apiTags.supprimerTag.mockResolvedValue(undefined)
  render(<TagsPage />, { wrapper: enrobage })
  await waitFor(() => expect(screen.getByText('seinen')).toBeInTheDocument())
})

describe('the count', () => {
  it('says on how many works each tag is set', () => {
    expect(screen.getByText('Sur 2 œuvres')).toBeInTheDocument()
    // A tag that nothing carries is not a lack of data: it is
    // precisely the one that can be removed without thinking.
    expect(screen.getByText('Sur aucune œuvre')).toBeInTheDocument()
  })
})

describe('rename', () => {
  it('keeps the tag and warns that the name will apply everywhere', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Renommer le tag seinen' }))

    expect(screen.getByText(/le nouveau nom s'appliquera partout/)).toBeInTheDocument()

    const champ = screen.getByLabelText('Nouveau nom du tag seinen')
    await userEvent.clear(champ)
    await userEvent.type(champ, 'seinen classique')
    await userEvent.click(screen.getByRole('button', { name: 'Renommer' }))

    await waitFor(() => expect(apiTags.renommerTag).toHaveBeenCalled())
    expect(apiTags.renommerTag.mock.calls[0]).toEqual(['tag-seinen', 'seinen classique'])
  })
})

describe('delete', () => {
  it('announces what will be detached, and what does not move', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le tag seinen' }))

    expect(screen.getByText(/retiré des 2 œuvres qui le portent/)).toBeInTheDocument()
    expect(screen.getByText(/elles, ne bougent pas/)).toBeInTheDocument()
    expect(apiTags.supprimerTag).not.toHaveBeenCalled()
  })

  it('only sends the request after confirmation', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le tag orphelin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => expect(apiTags.supprimerTag).toHaveBeenCalled())
    expect(apiTags.supprimerTag.mock.calls[0][0]).toBe('tag-orphelin')
  })
})
