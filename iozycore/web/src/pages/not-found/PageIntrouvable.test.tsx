/**
 * <b>The way back names the place it really leads to.</b> A visitor has no
 * collection: "Retour à ma collection" led them to the catalog.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageIntrouvable } from './PageIntrouvable'

const auth = vi.hoisted(() => ({ estInvite: false }))
vi.mock('@/common/hooks/useAuth', () => ({ useAuth: () => ({ estInvite: auth.estInvite }) }))

function rendre() {
  render(
    <MemoryRouter>
      <PageIntrouvable />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.estInvite = false
})

describe('an unknown address', () => {
  it('sends a visitor back to the catalog, and says so', () => {
    auth.estInvite = true
    rendre()

    expect(screen.getByRole('link', { name: 'Retour au catalogue' })).toHaveAttribute('href', '/add')
    expect(screen.queryByText(/ma collection/)).not.toBeInTheDocument()
  })

  it('sends an account back to its collection', () => {
    rendre()

    expect(screen.getByRole('link', { name: 'Retour à ma collection' })).toHaveAttribute('href', '/')
  })
})
