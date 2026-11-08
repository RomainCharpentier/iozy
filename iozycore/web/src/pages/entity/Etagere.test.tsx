/**
 * <b>A shelf says the state of each volume, and its gestures are named.</b>
 *
 * The rules that break silently: a spine is named by its state (the
 * journeys and the screen readers read nothing else), a click picks a
 * spine and the bar names the gesture for what is picked, "Je les ai" adds
 * a picked range in one gesture, removing an owned volume takes two, and a
 * visitor gets spines without any gesture.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Etagere } from './Etagere'
import { dosParEtage, formatEtagere, plageDeTomes, repartirEnEtages } from './etages'
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

  it('a click picks a volume, and the bar names "Je l\'ai" and the heart for it', () => {
    const onJeLAi = vi.fn()
    const onJeLeVeux = vi.fn()
    render(<Etagere volumes={VOLUMES} mode="navigation" onJeLAi={onJeLAi} onJeLeVeux={onJeLeVeux} />)
    // Nothing picked: no bar, no gesture anywhere.
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    expect(screen.getByRole('button', { name: 'Tome 2, manquant' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: "J'ai le tome 2" }))
    expect(onJeLAi).toHaveBeenCalledWith('2')
    // The gesture done, the volume is put back: the bar goes away.
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    fireEvent.click(screen.getByRole('button', { name: 'Je veux le tome 2' }))
    expect(onJeLeVeux).toHaveBeenCalledWith('2')
    // A wanted volume offers to leave the wishes, not to want it twice.
    fireEvent.click(screen.getByRole('button', { name: 'Tome 3, dans mes envies' }))
    expect(screen.getByRole('button', { name: 'Retirer le tome 3 de mes envies' })).toBeInTheDocument()
    // A second click on the spine puts it back.
    fireEvent.click(screen.getByRole('button', { name: 'Tome 3, dans mes envies' }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('Shift+click picks a range, and "Je les ai" adds what is not owned in one gesture', () => {
    const onJeLAi = vi.fn()
    const onJeLesAi = vi.fn()
    const volumes = [
      volume(1, 'possede'),
      volume(2, 'manquant'),
      volume(3, 'voulu'),
      volume(4, 'manquant'),
      volume(5, 'possede'),
      volume(6, 'manquant'),
    ]
    render(<Etagere volumes={volumes} mode="navigation" onJeLAi={onJeLAi} onJeLesAi={onJeLesAi} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tome 5, possédé' }), { shiftKey: true })
    const barre = screen.getByRole('toolbar', { name: 'Tomes choisis' })
    expect(barre).toHaveTextContent('Tomes 2 à 5')
    fireEvent.click(screen.getByRole('button', { name: "J'ai ces 3 tomes" }))
    expect(onJeLesAi).toHaveBeenCalledWith(['2', '3', '4'])
    expect(onJeLAi).not.toHaveBeenCalled()
  })

  it('names each gesture after its own targets when the pick is mixed', () => {
    render(<Etagere volumes={VOLUMES} mode="navigation" onJeLAi={vi.fn()} onJeLeVeux={vi.fn()} onRetirer={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    // Two picked: the gestures act on the missing one, and removing waits for a pick of owned volumes.
    expect(screen.getByRole('button', { name: "J'ai le tome 2" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Je veux le tome 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retirer le tome 1/ })).not.toBeInTheDocument()
  })

  it('removing an owned volume takes two gestures, and "Reposer" undoes the first', () => {
    const onRetirer = vi.fn()
    render(<Etagere volumes={VOLUMES} mode="navigation" onRetirer={onRetirer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le tome 1 de ma collection' }))
    expect(onRetirer).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reposer les tomes' }))
    expect(screen.queryByRole('button', { name: 'Confirmer le retrait du tome 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tome 1, possédé' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le tome 1 de ma collection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait du tome 1' }))
    expect(onRetirer).toHaveBeenCalledWith('1')
  })

  it('says how to pick at rest, and only previews a volume under the pointer', () => {
    render(<Etagere volumes={VOLUMES} mode="navigation" onJeLAi={vi.fn()} />)
    expect(screen.getByText('Clique un tome, Maj+clic pour une plage.')).toBeInTheDocument()
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    expect(screen.getByText(/· manquant/)).toBeInTheDocument()
    // Nothing was picked by hovering.
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('Escape puts every volume back', () => {
    render(<Etagere volumes={VOLUMES} mode="navigation" onJeLAi={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, manquant' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tome 2, manquant' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a visitor the volumes of the edition, without a state, a gesture or a pick', () => {
    render(<Etagere volumes={VOLUMES} mode="consultation" onJeLAi={vi.fn()} onRetirer={vi.fn()} />)
    // Nothing personal in the names: a visitor misses nothing, wants nothing.
    expect(screen.getByRole('button', { name: 'Tome 2' })).not.toHaveAttribute('aria-pressed')
    expect(screen.queryByRole('button', { name: /manquant|possédé|envies/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2' }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "J'ai le tome 2" })).not.toBeInTheDocument()
  })
})

describe('the shelves', () => {
  it('hold as many spines as the width allows, with a floor for a narrow screen', () => {
    expect(dosParEtage(880, 32)).toBe(25)
    expect(dosParEtage(358, 22)).toBe(14)
    expect(dosParEtage(100, 32)).toBe(6)
    // Unmeasured: one wide shelf rather than a tower of short ones.
    expect(dosParEtage(0, 32)).toBe(48)
  })

  it('split the volumes in reading order, the last shelf shorter', () => {
    const volumes = Array.from({ length: 110 }, (_, i) => i + 1)
    const etages = repartirEnEtages(volumes, 46)
    expect(etages.map((etage) => etage.length)).toEqual([46, 46, 18])
    expect(etages[0][0]).toBe(1)
    expect(etages[2][17]).toBe(110)
    expect(repartirEnEtages([], 46)).toEqual([])
  })

})

// A flat colored bar read as a chart. Owned without its own cover, a volume is
// cut from the cover of the series, and its number is the only thing that tells
// it from the next one.
describe('an owned volume without a cover', () => {
  it('is cut from the cover of the series and shows its number', () => {
    const { container } = render(<Etagere volumes={[volume(7, 'possede')]} mode="navigation" jaquetteSerie="https://x/serie.jpg" />)

    expect(container.querySelector('img[src="https://x/serie.jpg"]')).not.toBeNull()
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
  })

  it('keeps its own cover when it has one', () => {
    const avecJaquette = { ...volume(7, 'possede'), jaquetteUrl: 'https://x/tome.jpg' }
    const { container } = render(<Etagere volumes={[avecJaquette]} mode="navigation" jaquetteSerie="https://x/serie.jpg" />)

    expect(container.querySelector('img[src="https://x/serie.jpg"]')).toBeNull()
  })

  it('never lends the cover to a missing volume: it is a hole', () => {
    const { container } = render(<Etagere volumes={[volume(7, 'manquant')]} mode="navigation" jaquetteSerie="https://x/serie.jpg" />)

    expect(container.querySelector('img[src="https://x/serie.jpg"]')).toBeNull()
  })
})

describe('the size of a spine', () => {
  it('is the same for every series, and smaller on a phone', () => {
    expect(formatEtagere(880)).toEqual({ dos: 32, hauteur: 196 })
    expect(formatEtagere(358)).toEqual({ dos: 22, hauteur: 150 })
  })
})

describe('plageDeTomes', () => {
  it('says the volumes as a person would', () => {
    expect(plageDeTomes([3])).toBe('3')
    expect(plageDeTomes([5, 3, 4])).toBe('3 à 5')
    expect(plageDeTomes([1, 3, 4, 8])).toBe('1, 3 à 4 et 8')
  })
})

// The cover hid the volumes the mouse was heading to: moving left along a shelf,
// the next spines were behind the preview.
