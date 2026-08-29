/**
 * <b>Les deux sorties de Profil, et ce qui n'y est plus.</b>
 *
 * <p>Cet écran a longtemps servi de liste de raccourcis : il a porté « Analyser
 * une annonce » (déjà l'une des quatre destinations de la barre de navigation),
 * « Bilan annuel » (une lecture, pas un réglage) et la section Compte (dont la
 * déconnexion et l'export vivaient ailleurs). Chacun rendait l'écran un peu
 * moins lisible, sans jamais rien casser.
 *
 * <p>Il ne reste que ses deux <b>sorties</b> - Paramètres et Administration -
 * et elles sont sœurs : régler son thème et déclarer les catégories de sa
 * collection n'ont rien à voir, et l'un ne se trouve pas en cherchant l'autre.
 * Emboîter la seconde dans la première (ce qu'elle a été jusqu'au 2026-08-29)
 * mettait les éditions de référence à trois niveaux de profondeur.
 */
import { render, screen, within } from '@testing-library/react'
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

describe('les sorties de Profil', () => {
  it('mène aux Paramètres et à l’Administration, côte à côte', () => {
    const liste = screen.getByRole('list')

    expect(within(liste).getByRole('link', { name: /Paramètres/ })).toHaveAttribute('href', '/settings')
    expect(within(liste).getByRole('link', { name: /Administration/ })).toHaveAttribute('href', '/administration')
    // Deux sorties, et rien d'autre : cet écran n'est pas une liste de
    // raccourcis vers ce qui existe déjà ailleurs.
    expect(within(liste).getAllByRole('link')).toHaveLength(2)
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
