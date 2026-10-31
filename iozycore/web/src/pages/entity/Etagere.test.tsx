/**
 * <b>A shelf says the state of each volume, and its gestures are named.</b>
 *
 * The rules that break silently: a spine is named by its state (the
 * journeys and the screen readers read nothing else), "Je l'ai" and the
 * heart act in one gesture on a missing volume, removing an owned one takes
 * two, and a visitor gets spines without any gesture.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Etagere } from './Etagere'
import { coteDeLaCarte, dosParEtage, repartirEnEtages } from './etages'
import type { VolumeAffiche } from './GrilleVolumes'

function volume(numero: number, etat: 'possede' | 'manquant' | 'voulu'): VolumeAffiche {
  return { cle: String(numero), numero, jaquetteUrl: null, possede: etat === 'possede', voulu: etat === 'voulu', actif: false }
}

const VOLUMES = [volume(1, 'possede'), volume(2, 'manquant'), volume(3, 'voulu')]

describe('the shelf', () => {
  it('names each spine by its state', () => {
    render(<Etagere volumes={VOLUMES} mode="navigation" />)
    expect(screen.getByRole('button', { name: 'Tome 1, possédé' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tome 2, manquant' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tome 3, dans mes envies' })).toBeInTheDocument()
  })

  it('"Je l\'ai" and the heart act in one gesture on a missing volume', () => {
    const onJeLAi = vi.fn()
    const onJeLeVeux = vi.fn()
    render(<Etagere volumes={VOLUMES} mode="navigation" onJeLAi={onJeLAi} onJeLeVeux={onJeLeVeux} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    fireEvent.click(screen.getByRole('button', { name: "J'ai le tome 2" }))
    expect(onJeLAi).toHaveBeenCalledWith('2')
    fireEvent.click(screen.getByRole('button', { name: 'Je veux le tome 2' }))
    expect(onJeLeVeux).toHaveBeenCalledWith('2')
    // A wanted volume offers to leave the wishes, not to want it twice.
    expect(screen.getByRole('button', { name: 'Retirer le tome 3 de mes envies' })).toBeInTheDocument()
  })

  it('removing an owned volume takes two gestures, and "Garder" undoes the first', () => {
    const onRetirer = vi.fn()
    render(<Etagere volumes={VOLUMES} mode="navigation" onRetirer={onRetirer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le tome 1 de ma collection' }))
    expect(onRetirer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Garder le tome 1' }))
    expect(screen.queryByRole('button', { name: 'Confirmer le retrait du tome 1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le tome 1 de ma collection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait du tome 1' }))
    expect(onRetirer).toHaveBeenCalledWith('1')
  })

  it('shows a visitor the volumes of the edition, without a state or a gesture', () => {
    render(<Etagere volumes={VOLUMES} mode="consultation" onJeLAi={vi.fn()} onRetirer={vi.fn()} />)
    // Nothing personal in the names: a visitor misses nothing, wants nothing.
    expect(screen.getByRole('button', { name: 'Tome 2' })).not.toHaveAttribute('aria-expanded')
    expect(screen.queryByRole('button', { name: /manquant|possédé|envies/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "J'ai le tome 2" })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirer le tome 1 de ma collection' })).not.toBeInTheDocument()
  })
})

describe('the shelves', () => {
  it('hold as many spines as the width allows, never fewer than eight', () => {
    expect(dosParEtage(1232)).toBe(46)
    expect(dosParEtage(358)).toBe(12)
    expect(dosParEtage(120)).toBe(8)
    // Unmeasured: one wide shelf rather than a tower of short ones.
    expect(dosParEtage(0)).toBe(48)
  })

  it('split the volumes in reading order, the last shelf shorter', () => {
    const volumes = Array.from({ length: 110 }, (_, i) => i + 1)
    const etages = repartirEnEtages(volumes, 46)
    expect(etages.map((etage) => etage.length)).toEqual([46, 46, 18])
    expect(etages[0][0]).toBe(1)
    expect(etages[2][17]).toBe(110)
    expect(repartirEnEtages([], 46)).toEqual([])
  })

  it('open a cover where it fits: centered, or towards the inside near an end', () => {
    expect(coteDeLaCarte(0, 12)).toBe('gauche')
    expect(coteDeLaCarte(3, 12)).toBe('gauche')
    expect(coteDeLaCarte(5, 12)).toBe('centre')
    expect(coteDeLaCarte(8, 12)).toBe('droite')
    expect(coteDeLaCarte(11, 12)).toBe('droite')
    // The last, short shelf has room on its right: nothing opens to the left of the page.
    expect(coteDeLaCarte(1, 2)).toBe('gauche')
    expect(coteDeLaCarte(7, 8)).toBe('gauche')
  })
})
