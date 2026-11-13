import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TuileMur } from './TuileMur'
import type { Tuile } from './mur'

const tuile: Tuile = {
  cle: 'completer-frieren',
  genre: 'COMPLETER',
  largeur: 2,
  hauteur: 1,
  titre: 'Frieren',
  etat: 'Le dernier qui te manque',
  detail: 'Tome 4.',
  couleurDe: null,
  lien: '/entity/frieren',
  images: [{ cle: 'frieren', src: null, titre: 'Frieren', etat: 'possede', chiffre: null }],
  action: null,
  pave: null,
}

function Mur() {
  const [ouverte, setOuverte] = useState<string | null>(null)
  return (
    <ul>
      <TuileMur tuile={tuile} rang={0} ouverte={ouverte === tuile.cle} basculer={setOuverte} agir={() => {}} actionEnCours={false} />
    </ul>
  )
}

function rendre() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Mur />} />
        <Route path="/entity/frieren" element={<h1>Fiche de Frieren</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TuileMur', () => {
  it('turns over on a click on the cover, and the title on the back opens the work', async () => {
    const user = userEvent.setup()
    rendre()

    await user.click(screen.getByRole('button', { name: 'Frieren : Le dernier qui te manque' }))
    const dos = screen.getByRole('group', { name: 'Frieren' })
    expect(dos).toHaveTextContent('Tome 4.')
    expect(screen.queryByRole('heading', { name: 'Fiche de Frieren' })).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Frieren' }))
    expect(screen.getByRole('heading', { name: 'Fiche de Frieren' })).toBeInTheDocument()
  })

  it('stays turned on a second click on its back, as in a double click', async () => {
    const user = userEvent.setup()
    rendre()
    const recto = screen.getByRole('button', { name: 'Frieren : Le dernier qui te manque' })

    await user.dblClick(recto)
    await user.click(screen.getByText('Tome 4.'))

    expect(recto).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('group', { name: 'Frieren' })).toBeInTheDocument()
  })

  it('turns back on Escape, and gives the focus back to the cover', async () => {
    const user = userEvent.setup()
    rendre()
    const recto = screen.getByRole('button', { name: 'Frieren : Le dernier qui te manque' })

    await user.click(recto)
    expect(screen.getByRole('link', { name: 'Frieren' })).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(recto).toHaveAttribute('aria-expanded', 'false')
    expect(recto).toHaveFocus()
  })
})
