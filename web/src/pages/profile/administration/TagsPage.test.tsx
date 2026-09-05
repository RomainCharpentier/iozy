/**
 * <b>Faire le ménage dans les étiquettes.</b>
 *
 * <p>On pouvait créer un tag, l'attacher, puis filtrer dessus — jamais le
 * renommer ni le supprimer. Deux règles portent tout l'écran, et aucune ne
 * casse bruyamment :
 * <ul>
 *   <li>le <b>décompte</b> dit ce qu'une suppression va détacher. Supprimer un
 *       tag posé sur 12 œuvres et supprimer un tag qui ne sert à rien ne sont
 *       pas le même geste ;</li>
 *   <li><b>renommer n'est pas supprimer</b> : le tag garde son identité, seul
 *       son nom change — sur toutes les œuvres d'un coup.</li>
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

describe('le décompte', () => {
  it('dit sur combien d’œuvres chaque tag est posé', () => {
    expect(screen.getByText('Sur 2 œuvres')).toBeInTheDocument()
    // Un tag que rien ne porte n'est pas une absence de donnée : c'est
    // précisément celui qu'on peut retirer sans y penser.
    expect(screen.getByText('Sur aucune œuvre')).toBeInTheDocument()
  })
})

describe('renommer', () => {
  it('garde le tag et prévient que le nom s’appliquera partout', async () => {
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

describe('supprimer', () => {
  it('annonce ce qui sera détaché, et ce qui ne bouge pas', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le tag seinen' }))

    expect(screen.getByText(/retiré des 2 œuvres qui le portent/)).toBeInTheDocument()
    expect(screen.getByText(/elles, ne bougent pas/)).toBeInTheDocument()
    expect(apiTags.supprimerTag).not.toHaveBeenCalled()
  })

  it('n’envoie la demande qu’après confirmation', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer le tag orphelin' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => expect(apiTags.supprimerTag).toHaveBeenCalled())
    expect(apiTags.supprimerTag.mock.calls[0][0]).toBe('tag-orphelin')
  })
})
