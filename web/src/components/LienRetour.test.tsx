/**
 * <b>La sortie d'un écran qu'on a forcément ouvert depuis ailleurs.</b>
 *
 * <p>Dix écrans n'en avaient aucune. Ils sont tous accessibles depuis quelque
 * part et depuis nulle part ailleurs - « Comptes » depuis Administration,
 * « Bilan annuel » depuis Découvrir - et la seule sortie était le bouton
 * Précédent du navigateur, qui n'existe pas dans une app installée en plein
 * écran (le manifeste déclare {@code display: standalone}).
 *
 * <p>Deux règles, et chacune se casse en silence : le lien affiche la mauvaise
 * destination, ou il ramène ailleurs que là où il promet.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LienRetour } from './LienRetour'

const PARENT = { to: '/administration', libelle: 'Administration' }

/** Rend le lien sur une route, avec l'état qu'un appelant aurait posé. */
function ecran(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/administration/comptes', state }]}>
      <Routes>
        <Route path="/administration/comptes" element={<LienRetour parDefaut={PARENT} />} />
        <Route path="*" element={<Ou />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Dit où l'on a atterri - c'est ce que le lien PROMET qu'on vérifie. */
function Ou() {
  return <p>arrivé sur {useLocation().pathname}</p>
}

describe('sans origine nommée', () => {
  it('propose le parent naturel, et y mène vraiment', async () => {
    ecran()

    await userEvent.click(screen.getByRole('button', { name: 'Administration' }))

    expect(screen.getByText('arrivé sur /administration')).toBeInTheDocument()
  })

  it('vaut aussi pour un état qui n’a pas la bonne forme', () => {
    // `location.state` est un sac libre : un lien forgé ou une version
    // antérieure de l'app peut le remplir autrement. La page reste entière.
    ecran({ retour: 'Ma collection' })

    expect(screen.getByRole('button', { name: 'Administration' })).toBeInTheDocument()
  })
})

describe('avec une origine nommée', () => {
  it('propose celle-ci plutôt que le parent', async () => {
    // Les catégories de collection s'ouvrent aussi depuis Ma collection ▸ Plus
    // d'outils : y revenir par Administration serait un détour que personne
    // n'a demandé.
    ecran({ retour: { to: '/', libelle: 'Ma collection' } })

    await userEvent.click(screen.getByRole('button', { name: 'Ma collection' }))

    expect(screen.getByText('arrivé sur /')).toBeInTheDocument()
  })

  it('refuse une destination qui sortirait de l’application', () => {
    // Ce lien ne doit pas pouvoir devenir une redirection vers l'extérieur.
    ecran({ retour: { to: '//exemple.test', libelle: 'Ailleurs' } })

    expect(screen.getByRole('button', { name: 'Administration' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ailleurs' })).not.toBeInTheDocument()
  })
})

describe('le libellé', () => {
  it('nomme la destination, jamais « Retour » seul', () => {
    // Un « Retour » sans destination ment une fois sur deux - c'est ce que
    // ferait navigate(-1), qui ramène à l'écran précédent et non à celui qui
    // contient.
    ecran()

    const lien = screen.getByRole('button', { name: 'Administration' })
    expect(lien).not.toHaveTextContent(/^Retour$/)
  })
})
