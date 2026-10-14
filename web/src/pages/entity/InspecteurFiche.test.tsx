/**
 * <b>Each SOURCE field in edit mode has a name a person can read.</b> The
 * label next to the field is only a neighbouring text: without its own name, a
 * screen reader announces six bare "zone de texte", and a raw key like "malId"
 * says nothing to anyone.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ColonneSource, InspecteurFiche } from './InspecteurFiche'
import { CLES_SOURCE, type BrouillonAttributs } from './useBrouillonInspecteur'

const brouillon: BrouillonAttributs = {
  valeur: () => '',
  saisir: () => {},
  saisi: () => false,
  clesOeuvre: [],
  clesSource: CLES_SOURCE.map(({ cle }) => cle),
}

describe('the SOURCE column in edit mode', () => {
  it('gives every field a French accessible name', () => {
    render(<ColonneSource attributs={{}} brouillon={brouillon} />)

    const champs = screen.getAllByRole('textbox')
    expect(champs).toHaveLength(CLES_SOURCE.length)
    expect(screen.getByRole('textbox', { name: 'Identifiant MyAnimeList' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Titre romaji' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Année de fin' })).toBeInTheDocument()
  })

  it('never shows a raw attribute key', () => {
    render(<ColonneSource attributs={{}} brouillon={brouillon} />)

    expect(screen.queryByText('malId')).not.toBeInTheDocument()
  })
})

// While reading, provider internals fold under "Détails techniques" (UI review
// of 2026-10-13). Two silent breaks: the ids are shown again by default, or the
// row no longer opens and they become unreachable.
describe('the SOURCE column while reading', () => {
  function panneau() {
    render(
      <InspecteurFiche
        teinte={[192, 90, 60]}
        oeuvre={<span>Kentarou Miura</span>}
        source={<ColonneSource attributs={{ malId: '2' }} />}
        sourceRepliee
      />,
    )
  }

  it('hides the provider ids until asked', () => {
    panneau()

    expect(screen.getByRole('button', { name: 'Détails techniques' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Identifiant MyAnimeList')).not.toBeInTheDocument()
  })

  it('shows them once the row is opened', async () => {
    panneau()

    await userEvent.click(screen.getByRole('button', { name: 'Détails techniques' }))

    expect(screen.getByText('Identifiant MyAnimeList')).toBeInTheDocument()
  })
})
