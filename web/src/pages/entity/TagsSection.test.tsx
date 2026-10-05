/**
 * <b>The tags of a work: read by everyone, set by an administrator.</b>
 *
 * <p>A tag describes the WORK and lives in the shared catalog: setting it affects
 * all accounts. The server refuses writes (403) - this component only avoids
 * offering gestures that would lead to a refusal.
 *
 * <p>Both mistakes are silent: offering the chips to someone who can do nothing
 * (clicks that fail without explanation), or hiding them from someone who can
 * (a capability that disappears).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { TagsSection } from './TagsSection'

vi.mock('@/common/api/tags', () => ({ attachTag: vi.fn(), createTag: vi.fn(), detachTag: vi.fn() }))

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

const TAGS = [
  { id: 'tag-seinen', label: 'seinen' },
  { id: 'tag-shonen', label: 'shonen' },
]

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function ecranPour(admin: boolean) {
  auth.useAuth.mockReturnValue({ compte: { id: 'u1', email: 'moi@example.com', pseudo: 'moi', admin } })
  render(<TagsSection entityId="e1" attachedTagIds={['tag-seinen']} allTags={TAGS} />, { wrapper: enrobage })
}

beforeEach(() => vi.clearAllMocks())

describe('an ordinary account', () => {
  it('sees the tags of the work, without being able to touch them', () => {
    ecranPour(false)

    // Reading: they describe the work, and they are used to filter its collection.
    expect(screen.getByText('seinen')).toBeInTheDocument()
    // No gesture: no removing, no attaching, no creating.
    expect(screen.queryByRole('button', { name: /seinen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shonen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter ce tag' })).not.toBeInTheDocument()
    // And the screen SAYS why, instead of leaving people searching.
    expect(screen.getByText(/seul un administrateur les pose/)).toBeInTheDocument()
  })
})

describe('an administrator', () => {
  it('can remove, attach and create', () => {
    ecranPour(true)

    expect(screen.getByRole('button', { name: 'seinen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ shonen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter ce tag' })).toBeInTheDocument()
    expect(screen.queryByText(/seul un administrateur les pose/)).not.toBeInTheDocument()
  })
})
