/**
 * <b>Ce que Profil n'est plus.</b>
 *
 * <p>Cet écran a longtemps servi de liste de raccourcis : il a porté « Analyser
 * une annonce » (déjà l'une des quatre destinations de la barre de navigation),
 * « Bilan annuel » (une lecture, pas un réglage), la section Compte (dont la
 * déconnexion et l'export vivaient ailleurs), puis les liens vers Paramètres et
 * Administration. Chacun rendait l'écran un peu moins lisible, sans jamais rien
 * casser.
 *
 * <p>Il n'est plus un <b>couloir</b> : l'administration a son propre bouton
 * dans l'en-tête (voir GlobalShortcuts), et cet écran ne mène plus qu'aux
 * réglages - le seul autre écran qui parle de la même personne. Le reste
 * concerne CETTE collection : sa valeur, ses classements, son partage.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ProfilePage } from './ProfilePage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../lib/useAuth', () => auth)

// Trois sections vivantes de cet écran, chacune avec ses propres requêtes :
// ce test parle de la NAVIGATION, pas de ce qu'elles affichent.
vi.mock('./ProfileValueHero', () => ({ ProfileValueHero: () => null }))
vi.mock('./ProfileTierListsSection', () => ({ ProfileTierListsSection: () => null }))
vi.mock('../Share/ShareSection', () => ({ ShareSection: () => null }))

function enrobage({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.useAuth.mockReturnValue({ compte: { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: true } })
  render(<ProfilePage />, { wrapper: enrobage })
})

describe('la seule sortie de Profil', () => {
  it('mène aux réglages, qui parlent de la même personne', () => {
    expect(screen.getByRole('link', { name: /Paramètres/ })).toHaveAttribute('href', '/settings')
  })

  it('ne remet pas l’administration derrière le profil', () => {
    // Elle y a déjà été rangée, comme sous Paramètres et dans un menu de
    // l'avatar. Elle a maintenant son bouton dans l'en-tête, et l'y remettre
    // ici serait la quatrième fois.
    expect(screen.queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })

  it('ne double plus une destination de la barre de navigation', () => {
    // « Analyser une annonce » est l'un des quatre onglets globaux.
    expect(screen.queryByRole('link', { name: /Analyser une annonce/ })).not.toBeInTheDocument()
  })

  it('ne porte plus le bilan annuel, qui est une lecture', () => {
    expect(screen.queryByRole('link', { name: /Bilan annuel/ })).not.toBeInTheDocument()
  })
})

describe('l’identité', () => {
  it('dit de qui c’est le profil, sans reprendre les actions du compte', () => {
    // Le pseudo en sous-titre : un écran qui s'appelle « Mon profil » doit
    // nommer la personne. Mais se déconnecter, l'adresse et l'export vivent
    // dans Paramètres ▸ Mon compte - un seul endroit, pas deux moitiés.
    expect(screen.getByText('romain')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Se déconnecter/ })).not.toBeInTheDocument()
    expect(screen.queryByText('moi@example.com')).not.toBeInTheDocument()
  })
})
