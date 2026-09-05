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
 * dans l'en-tête (voir GlobalShortcuts), et les réglages sont SUR cet écran
 * (lot 140) - plus derrière un lien « Paramètres ». Le reste concerne CETTE
 * collection : sa valeur, ses classements, son partage.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ProfilePage } from './ProfilePage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

// Trois sections vivantes de cet écran, chacune avec ses propres requêtes :
// ce test parle de la NAVIGATION, pas de ce qu'elles affichent.
vi.mock('./ProfileValueHero', () => ({ ProfileValueHero: () => null }))
vi.mock('./ProfileTierListsSection', () => ({ ProfileTierListsSection: () => null }))
vi.mock('./ShareSection', () => ({ ShareSection: () => null }))

function enrobage({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.useAuth.mockReturnValue({ compte: { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: true } })
  render(<ProfilePage />, { wrapper: enrobage })
})

describe('les réglages, sur la page même', () => {
  it('porte « Mon compte » et « Cet appareil » en clair, sans lien Paramètres', () => {
    // « Pas de sous-menu, ça doit être lisible direct » (lot 140) : ce qui
    // parle de la même personne n'ouvre pas un second écran.
    expect(screen.getByRole('region', { name: 'Mon compte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cet appareil' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Paramètres/ })).not.toBeInTheDocument()
  })

  it('ne propose plus « Demander à ma collection »', () => {
    // Lot 117, retirée au lot 140 : « ne sert à rien ».
    expect(screen.queryByRole('link', { name: /Demander à ma collection/ })).not.toBeInTheDocument()
  })
})

describe('ce que Profil ne double pas', () => {

  it('ne remet pas l’administration derrière le profil', () => {
    // Elle y a déjà été rangée, comme sous Paramètres et dans un menu de
    // l'avatar. Elle a maintenant son bouton dans l'en-tête, et l'y remettre
    // ici serait la quatrième fois.
    expect(screen.queryByRole('link', { name: /Administration/ })).not.toBeInTheDocument()
  })

  it('ne mène pas à l’analyse d’une annonce, qui a ses portes ailleurs', () => {
    // Elle a été l'un des quatre onglets globaux ; depuis le lot 137 elle se
    // rejoint depuis Découvrir et depuis la fiche d'une série. Le profil
    // n'a pas plus de raison de la doubler qu'avant.
    expect(screen.queryByRole('link', { name: /Analyser une annonce/ })).not.toBeInTheDocument()
  })

  it('ne porte plus le bilan annuel, qui est une lecture', () => {
    expect(screen.queryByRole('link', { name: /Bilan annuel/ })).not.toBeInTheDocument()
  })
})

describe('l’identité', () => {
  it('dit de qui c’est le profil, et le compte se lit dessous', () => {
    // Le pseudo en sous-titre : un écran qui s'appelle « Mon profil » doit
    // nommer la personne. Il le redit dans « Mon compte », avec l'adresse -
    // sur cette page depuis le lot 140. La déconnexion, elle, reste dans
    // l'en-tête : le même bouton sur tous les écrans.
    expect(screen.getAllByText('romain')).toHaveLength(2)
    expect(screen.getByText('moi@example.com')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Se déconnecter/ })).not.toBeInTheDocument()
  })
})
