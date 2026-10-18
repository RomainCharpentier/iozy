/**
 * <b>An edition card says what the edition IS to a visitor, never a
 * progress.</b> "0 tome" under "Glénat" reads as the state of a collection -
 * someone else's, or one the visitor does not have.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CartesEditions } from './CartesEditions'

function rendre(consultation: boolean, total: number | null) {
  render(
    <CartesEditions
      editions={[{ nom: 'Glénat', editeur: null, total, possedes: 0 }]}
      editionAffichee="Glénat"
      onAfficher={() => {}}
      consultation={consultation}
    />,
  )
}

describe('the edition card of a visitor', () => {
  it('shows no count of owned volumes', () => {
    rendre(true, 72)

    expect(screen.getByText('72 tomes')).toBeInTheDocument()
    expect(screen.queryByText(/0\/72|0 tome/)).not.toBeInTheDocument()
    expect(screen.queryByText(/possédé/)).not.toBeInTheDocument()
  })

  it('says the number of volumes is unknown, without asking to fill it in', () => {
    rendre(true, null)

    expect(screen.getByText('Nombre de tomes non renseigné')).toBeInTheDocument()
    expect(screen.queryByText('Détails à renseigner')).not.toBeInTheDocument()
  })

  it('keeps the progress for an account', () => {
    rendre(false, 72)

    expect(screen.getByText('0/72')).toBeInTheDocument()
  })
})
