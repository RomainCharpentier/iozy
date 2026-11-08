/**
 * <b>The panel of a work says what I have and what I miss, in words read on screen.</b>
 *
 * A total nobody knows is never guessed; a paused work keeps its gaps drawn but
 * stops counting them; a missing element is named by what a click does, and
 * no element carries a word of state; removing takes two clicks, in place.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WorkDto, WorkElementDto } from '@/common/types/api'
import { GrilleElements } from './GrilleElements'
import { PanneauOeuvre, StatutCollection, TotalOeuvre } from './PanneauOeuvre'
import { gesteJeLAi } from './elementsOeuvre'

function tome(numero: number, etat: WorkElementDto['state']): WorkElementDto {
  return {
    key: `volume-${numero}`,
    label: `Tome ${numero}`,
    number: numero,
    coverImageUrl: null,
    state: etat,
    releaseDate: null,
    variantId: null,
    ownershipId: etat === 'OWNED' ? `o-${numero}` : null,
    countedAsMissing: etat === 'MISSING',
    optional: false,
    linkedEntityId: null,
  }
}

function oeuvre(options: Partial<WorkDto> = {}): WorkDto {
  return {
    entityId: 'e',
    entityTypeId: 't',
    title: 'Vagabond',
    coverImageUrl: null,
    collectorStatus: 'ONGOING',
    ownedCount: 1,
    totalCount: 6,
    missingCount: 5,
    totalKnown: true,
    elements: [tome(1, 'OWNED'), tome(2, 'MISSING')],
    nextRelease: null,
    lastMovedAt: null,
    elementsSource: null,
    ...options,
  }
}

function grille(work: WorkDto, props: Partial<Parameters<typeof GrilleElements>[0]> = {}) {
  return (
    <GrilleElements
      elements={work.elements}
      forme="aspect-[2/3]"
      jaquetteOeuvre={null}
      gesteDe={(e) => gesteJeLAi(e, true)}
      onJeLAi={() => undefined}
      onRetirer={() => undefined}
      immobile={work.collectorStatus !== 'ONGOING'}
      consultation={false}
      enCours={new Set()}
      {...props}
    />
  )
}

describe('the panel of a work', () => {
  it('shows the count over the known total and what is missing', () => {
    const work = oeuvre()
    render(<PanneauOeuvre avecGeste work={work} consultation={false} total={null} grille={grille(work)} />)
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(screen.getByText('Il t’en manque 5')).toBeInTheDocument()
  })

  it('says the count in words for a screen reader, never "1 slash 6"', () => {
    const work = oeuvre()
    render(<PanneauOeuvre avecGeste work={work} consultation={false} total={null} grille={grille(work)} />)
    expect(screen.getByText('1 possédé sur 6')).toBeInTheDocument()
    expect(screen.getByText('1 / 6')).toHaveAttribute('aria-hidden', 'true')
  })

  it('invites no click when no element can be owned in one click', () => {
    const work = oeuvre()
    render(
      <PanneauOeuvre
        avecGeste={false}
        work={work}
        consultation={false}
        total={null}
        grille={grille(work, { gesteDe: () => null })}
      />,
    )
    expect(screen.queryByText(/Clique/)).not.toBeInTheDocument()
  })

  it('never guesses a total nobody knows', () => {
    const work = oeuvre({ totalCount: null, totalKnown: false, missingCount: 0 })
    render(
      <PanneauOeuvre
        avecGeste
        work={work}
        consultation={false}
        total={<TotalOeuvre total={null} provenance={null} editable={false} enCours={false} erreur={null} onEnregistrer={async () => undefined} />}
        grille={grille(work)}
      />,
    )
    expect(screen.getByText('1', { selector: 'p > span' })).toBeInTheDocument()
    expect(screen.getByText('1 possédé, total inconnu')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument()
    expect(screen.getByText('total inconnu')).toBeInTheDocument()
  })

  it('stops counting what is missing once paused, but still draws it', () => {
    const work = oeuvre({ collectorStatus: 'PAUSED', missingCount: 0 })
    render(<PanneauOeuvre avecGeste work={work} consultation={false} total={null} grille={grille(work)} />)
    expect(screen.queryByText(/Il t’en manque/)).not.toBeInTheDocument()
    expect(screen.getByText('En pause : ce qui manque ne compte plus')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Tome 2 : je l'ai" })).toBeInTheDocument()
  })

  it('says the next release', () => {
    const work = oeuvre({
      nextRelease: { date: '2026-12-04', precision: 'DAY', label: 'Tome 7', volumeNumber: 7, price: null },
    })
    render(<PanneauOeuvre avecGeste work={work} consultation={false} total={null} grille={grille(work)} />)
    expect(screen.getByText('Tome 7 · vendredi 4 décembre')).toBeInTheDocument()
  })

  it('shows a visitor the catalog, with no count of a collection', () => {
    const work = oeuvre({ ownedCount: 0 })
    render(<PanneauOeuvre avecGeste work={work} consultation total={null} grille={grille(work, { consultation: true })} />)
    expect(screen.getByText('6 au catalogue')).toBeInTheDocument()
    expect(screen.queryByText(/manque/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Tome 2')).toBeInTheDocument()
  })
})

describe('the grid of the elements', () => {
  it('names a missing element by what a click does, and adds it in one click', () => {
    const onJeLAi = vi.fn()
    render(grille(oeuvre(), { onJeLAi }))
    fireEvent.click(screen.getByRole('button', { name: "Tome 2 : je l'ai" }))
    expect(onJeLAi).toHaveBeenCalledWith(expect.objectContaining({ key: 'volume-2' }))
  })

  it('writes no word of state under any element', () => {
    render(grille(oeuvre()))
    expect(screen.queryByText(/manquant|possédé|en pause|voulu/i)).not.toBeInTheDocument()
  })

  it('removes an owned element only on the second click, in place', () => {
    const onRetirer = vi.fn()
    render(grille(oeuvre(), { onRetirer }))
    fireEvent.click(screen.getByRole('button', { name: 'Tome 1' }))
    expect(onRetirer).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Garder' }))
    expect(screen.queryByRole('button', { name: 'Retirer Tome 1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tome 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer Tome 1' }))
    expect(onRetirer).toHaveBeenCalledWith(expect.objectContaining({ key: 'volume-1' }))
  })

  it('offers no removal of an owned element whose copy lives elsewhere', () => {
    const onRetirer = vi.fn()
    render(grille(oeuvre(), { onRetirer, peutRetirer: () => false }))
    fireEvent.click(screen.getByRole('button', { name: 'Tome 1' }))
    expect(screen.queryByRole('button', { name: 'Retirer Tome 1' })).not.toBeInTheDocument()
    expect(onRetirer).not.toHaveBeenCalled()
  })

  it('offers no click on a missing element that nothing can own', () => {
    render(grille(oeuvre(), { gesteDe: () => null }))
    expect(screen.queryByRole('button', { name: /je l'ai/ })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Tome 2' })).toBeInTheDocument()
  })
})

describe('the total of an edition', () => {
  it('is typed in place, then saved as a number', async () => {
    const onEnregistrer = vi.fn(async () => undefined)
    render(<TotalOeuvre total={null} provenance={null} editable enCours={false} erreur={null} onEnregistrer={onEnregistrer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saisir le total' }))
    fireEvent.change(screen.getByLabelText('Total de l’édition'), { target: { value: '18' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(onEnregistrer).toHaveBeenCalledWith(18)
  })

  it('says where a known total comes from, and clears it', () => {
    const onEnregistrer = vi.fn(async () => undefined)
    render(<TotalOeuvre total={18} provenance="saisi par toi" editable enCours={false} erreur={null} onEnregistrer={onEnregistrer} />)
    expect(screen.getByText('Total saisi par toi')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Effacer le total' }))
    expect(onEnregistrer).toHaveBeenCalledWith(null)
  })

  it('offers no field when the work is not counted in editions', () => {
    render(<TotalOeuvre total={null} provenance={null} editable={false} enCours={false} erreur={null} onEnregistrer={async () => undefined} />)
    expect(screen.queryByRole('button', { name: 'Saisir le total' })).not.toBeInTheDocument()
  })
})

describe('the collector status', () => {
  it('names the three choices and sends the one picked', () => {
    const onChoisir = vi.fn()
    render(<StatutCollection statut="ONGOING" enCours={false} onChoisir={onChoisir} />)
    expect(screen.getByRole('radio', { name: 'En cours' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Abandonnée' }))
    expect(onChoisir).toHaveBeenCalledWith('DROPPED')
  })
})
