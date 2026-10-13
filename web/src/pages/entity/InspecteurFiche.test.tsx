/**
 * <b>Each SOURCE field in edit mode has a name a person can read.</b> The
 * label next to the field is only a neighbouring text: without its own name, a
 * screen reader announces six bare "zone de texte", and a raw key like "malId"
 * says nothing to anyone.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ColonneSource } from './InspecteurFiche'
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
