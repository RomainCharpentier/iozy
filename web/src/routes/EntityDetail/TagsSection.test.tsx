/**
 * <b>Les tags d'une œuvre : lus par tous, posés par un administrateur.</b>
 *
 * <p>Un tag décrit l'ŒUVRE et vit dans le catalogue partagé : le poser engage
 * tous les comptes. Le serveur refuse l'écriture (403) — ce composant évite
 * seulement de proposer des gestes qui ne mèneraient qu'à un refus.
 *
 * <p>Les deux erreurs sont muettes : proposer les chips à qui ne peut rien
 * (des clics qui échouent sans qu'on comprenne), ou les masquer à qui peut
 * (une capacité qui disparaît).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { TagsSection } from './TagsSection'

vi.mock('../../api/tags', () => ({ attachTag: vi.fn(), createTag: vi.fn(), detachTag: vi.fn() }))

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../lib/useAuth', () => auth)

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

describe('un compte ordinaire', () => {
  it('voit les tags de l’œuvre, sans pouvoir y toucher', () => {
    ecranPour(false)

    // Lecture : ils décrivent l'œuvre, et ils servent à filtrer sa collection.
    expect(screen.getByText('seinen')).toBeInTheDocument()
    // Aucun geste : ni retirer, ni attacher, ni créer.
    expect(screen.queryByRole('button', { name: /seinen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /shonen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter ce tag' })).not.toBeInTheDocument()
    // Et l'écran DIT pourquoi, au lieu de laisser chercher.
    expect(screen.getByText(/seul un administrateur les pose/)).toBeInTheDocument()
  })
})

describe('un administrateur', () => {
  it('peut retirer, attacher et créer', () => {
    ecranPour(true)

    expect(screen.getByRole('button', { name: 'seinen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ shonen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter ce tag' })).toBeInTheDocument()
    expect(screen.queryByText(/seul un administrateur les pose/)).not.toBeInTheDocument()
  })
})
