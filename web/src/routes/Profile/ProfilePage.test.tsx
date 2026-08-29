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
 * <p>Il n'est plus un <b>couloir</b> : les trois écrans du compte sont sœurs,
 * dans le menu de l'avatar (voir GlobalShortcuts), à égale distance et depuis
 * partout. Ce qui reste ici parle de CETTE collection - sa valeur, ses
 * classements, son partage.
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

describe('ce que Profil ne porte plus', () => {
  it('n’est plus un couloir vers les réglages ni l’administration', () => {
    // Les trois écrans du compte vivent dans le menu de l'avatar, sœurs et à
    // égale distance. Un lien de plus ici referait de cet écran un passage
    // obligé, et remettrait l'administration derrière quelque chose.
    expect(screen.queryByRole('link', { name: /Paramètres/ })).not.toBeInTheDocument()
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
