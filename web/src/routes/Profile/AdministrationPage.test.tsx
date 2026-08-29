/**
 * <b>Une porte qu'on ne propose qu'à qui peut l'ouvrir.</b>
 *
 * <p>Masquer « Comptes » ne <b>protège</b> rien : le serveur répond 403 sur
 * tout `/api/admin/**`, quel que soit l'écran. Ce qui se joue ici est autre
 * chose — proposer à quelqu'un un lien qui ne mènera qu'à une erreur, c'est lui
 * faire croire à un droit qu'il n'a pas, puis le laisser se demander ce qui a
 * cassé.
 *
 * <p>Et l'erreur inverse — le lien absent pour un administrateur — rend
 * l'écran introuvable autrement qu'en tapant l'URL.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AdministrationPage } from './AdministrationPage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../lib/useAuth', () => auth)

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

describe('l’entrée « Comptes »', () => {
  it('est proposée à un administrateur', () => {
    ecranPour(true)

    expect(screen.getByRole('link', { name: /Comptes/ })).toHaveAttribute('href', '/administration/comptes')
  })

  it('est absente pour un compte ordinaire', () => {
    ecranPour(false)

    expect(screen.queryByRole('link', { name: /Comptes/ })).not.toBeInTheDocument()
    // Le reste de l'écran, lui, s'adresse à tout le monde.
    expect(screen.getByRole('link', { name: /Types de collection/ })).toBeInTheDocument()
  })

  it('est absente tant qu’on ne sait pas encore qui est là', () => {
    // Le compte arrive par une requête : avant sa réponse, ne rien proposer
    // vaut mieux qu'un lien qui apparaît puis disparaît.
    ecranPour(null)

    expect(screen.queryByRole('link', { name: /Comptes/ })).not.toBeInTheDocument()
  })
})
