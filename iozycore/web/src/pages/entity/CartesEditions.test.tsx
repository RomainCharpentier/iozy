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

// With no total, an empty gauge beside a bare "10 tomes" read as a broken bar
// on an edition of ten volumes.
describe('the edition card of an account, with no known total', () => {
  it('says what the count counts, and asks for nothing', () => {
    render(
      <CartesEditions
        editions={[{ nom: 'Ki-oon', editeur: null, total: null, possedes: 10 }]}
        editionAffichee="Ki-oon"
        onAfficher={() => {}}
      />,
    )

    expect(screen.getByText('10 tomes possédés')).toBeInTheDocument()
    expect(screen.queryByText('Détails à renseigner')).not.toBeInTheDocument()
    expect(screen.queryByText('10 tomes')).not.toBeInTheDocument()
  })
})

describe('the "Suivie" badge of an edition', () => {
  const editions = [
    { nom: 'Ki-oon', editeur: null, total: 12, possedes: 10 },
    { nom: 'Collector', editeur: null, total: 3, possedes: 0 },
  ]

  it('appears when there are several editions to tell apart', () => {
    render(<CartesEditions editions={editions} editionAffichee="Ki-oon" editionSuivie="Ki-oon" onAfficher={() => {}} />)

    expect(screen.getByText('Suivie')).toBeInTheDocument()
  })

  it('stays silent on a single edition: the band already says it', () => {
    render(<CartesEditions editions={[editions[0]]} editionAffichee="Ki-oon" editionSuivie="Ki-oon" onAfficher={() => {}} />)

    expect(screen.queryByText('Suivie')).not.toBeInTheDocument()
  })
})
