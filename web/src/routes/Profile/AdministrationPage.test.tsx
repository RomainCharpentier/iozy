/**
 * <b>Deux échelles, et une porte qu'on ne propose qu'à qui peut l'ouvrir.</b>
 *
 * <p>Cet écran a longtemps été un fourre-tout : les catégories de collection,
 * l'import, l'export des données et — depuis peu — les comptes, tous dans la
 * même liste plate. Il porte maintenant deux sections nommées, et la
 * distinction n'est pas cosmétique : <b>Ma collection</b> décrit son contenu,
 * <b>Cette instance</b> décrit la machine. Une entrée rangée du mauvais côté
 * ne casse rien — elle rend juste l'écran illisible à nouveau.
 *
 * <p>Masquer « Comptes » ne <b>protège</b> rien : le serveur répond 403 sur
 * tout `/api/admin/**`, quel que soit l'écran. Ce qui se joue ici est autre
 * chose — proposer à quelqu'un un lien qui ne mènera qu'à une erreur, c'est lui
 * faire croire à un droit qu'il n'a pas, puis le laisser se demander ce qui a
 * cassé. Et l'erreur inverse — le lien absent pour un administrateur — rend
 * l'écran introuvable autrement qu'en tapant l'URL.
 */
import { render, screen, within } from '@testing-library/react'
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

/** Une section nommée, pour vérifier ce qu'elle contient - et rien d'autre. */
function section(titre: string) {
  return screen.getByRole('region', { name: titre })
}

describe('« Ma collection »', () => {
  it('regroupe ce qui décrit le contenu de la collection', () => {
    ecranPour(false)

    const maCollection = section('Ma collection')
    expect(within(maCollection).getByRole('link', { name: /Catégories de collection/ })).toBeInTheDocument()
    expect(within(maCollection).getByRole('link', { name: /Éditions de référence/ })).toBeInTheDocument()
    expect(within(maCollection).getByRole('link', { name: /Importer depuis BGG/ })).toBeInTheDocument()
  })

  it('ne contient plus l’export, qui appartient au compte', () => {
    // Il vivait ici, à côté des catégories, comme si emporter sa collection
    // était de la configuration technique. Il est dans Paramètres ▸ Mon compte.
    ecranPour(true)

    expect(screen.queryByText(/Télécharger en JSON/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Télécharger en CSV/)).not.toBeInTheDocument()
  })
})

describe('« Cette instance »', () => {
  it('existe pour un administrateur, et ne porte que les comptes', () => {
    ecranPour(true)

    const instance = section('Cette instance')
    expect(within(instance).getByRole('link', { name: /Comptes/ })).toHaveAttribute(
      'href',
      '/administration/comptes',
    )
    // Le contenu de la collection n'a rien à faire à cette échelle-là.
    expect(within(instance).queryByRole('link', { name: /Catégories/ })).not.toBeInTheDocument()
  })

  it('n’existe pas du tout pour un compte ordinaire', () => {
    ecranPour(false)

    expect(screen.queryByRole('region', { name: 'Cette instance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Comptes/ })).not.toBeInTheDocument()
    // Le reste de l'écran, lui, s'adresse à tout le monde.
    expect(section('Ma collection')).toBeInTheDocument()
  })

  it('n’existe pas tant qu’on ne sait pas encore qui est là', () => {
    // Le compte arrive par une requête : avant sa réponse, ne rien proposer
    // vaut mieux qu'un lien qui apparaît puis disparaît.
    ecranPour(null)

    expect(screen.queryByRole('region', { name: 'Cette instance' })).not.toBeInTheDocument()
  })
})
