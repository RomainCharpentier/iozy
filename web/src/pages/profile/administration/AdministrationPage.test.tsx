/**
 * <b>Two scales, and a door that is only offered to whoever can open it.</b>
 *
 * <p>This screen was long a catch-all: the collection categories,
 * the import, the data export and - recently - the accounts, all in the
 * same flat list. It now carries two named sections, and the
 * distinction is not cosmetic: <b>Ma collection</b> describes its content,
 * <b>Cette instance</b> describes the machine. An entry put on the wrong side
 * breaks nothing - it just makes the screen unreadable again.
 *
 * <p>Hiding "Comptes" does not <b>protect</b> anything: the server answers 403 on
 * all `/api/admin/**`, whatever the screen. What is at stake here is something else
 * - offering someone a link that will only lead to an error makes them
 * believe in a right they do not have, then leaves them wondering what
 * broke. And the opposite error - the link missing for an administrator - makes
 * the screen unfindable except by typing the URL.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AdministrationPage } from './AdministrationPage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

function enrobage({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

beforeEach(() => vi.clearAllMocks())

function ecranPour(admin: boolean | null) {
  auth.useAuth.mockReturnValue({
    compte: admin === null ? null : { id: 'u1', email: 'moi@example.com', pseudo: 'moi', admin },
  })
  render(<AdministrationPage />, { wrapper: enrobage })
}

/** A named section, to check what it contains - and nothing else. */
function section(titre: string) {
  return screen.getByRole('region', { name: titre })
}

describe('"Ma collection"', () => {
  it('only groups what DESCRIBES the collection', () => {
    ecranPour(false)

    const maCollection = section('Ma collection')
    expect(within(maCollection).getByRole('link', { name: /Catégories de collection/ })).toBeInTheDocument()
    expect(within(maCollection).getByRole('link', { name: /Éditions de référence/ })).toBeInTheDocument()
    expect(within(maCollection).getAllByRole('link')).toHaveLength(2)
  })

  it('no longer contains the export, which belongs to the account', () => {
    // It lived here, next to the categories, as if taking one's collection away
    // were technical configuration. It is in Paramètres ▸ Mon compte.
    ecranPour(true)

    expect(screen.queryByText(/Télécharger en JSON/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Télécharger en CSV/)).not.toBeInTheDocument()
  })

  it('no longer contains the BGG import, which ADDS to the collection', () => {
    // Getting one's games from BoardGameGeek is the same intention as typing
    // a title or scanning a barcode, with a third source. It is
    // Rechercher, not administration.
    ecranPour(true)

    expect(screen.queryByRole('link', { name: /Importer depuis BGG/ })).not.toBeInTheDocument()
  })
})

describe('"Cette instance"', () => {
  it('exists for an administrator, and only carries the accounts', () => {
    ecranPour(true)

    const instance = section('Cette instance')
    expect(within(instance).getByRole('link', { name: /Comptes/ })).toHaveAttribute(
      'href',
      '/administration/comptes',
    )
    // The content of the collection has nothing to do on that scale.
    expect(within(instance).queryByRole('link', { name: /Catégories/ })).not.toBeInTheDocument()
  })

  it('does not exist at all for an ordinary account', () => {
    ecranPour(false)

    expect(screen.queryByRole('region', { name: 'Cette instance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Comptes/ })).not.toBeInTheDocument()
    // The rest of the screen, for its part, is for everybody.
    expect(section('Ma collection')).toBeInTheDocument()
  })

  it('does not exist as long as we do not know yet who is here', () => {
    // The account arrives through a query: before its answer, offering nothing
    // is better than a link that appears and then disappears.
    ecranPour(null)

    expect(screen.queryByRole('region', { name: 'Cette instance' })).not.toBeInTheDocument()
  })
})
