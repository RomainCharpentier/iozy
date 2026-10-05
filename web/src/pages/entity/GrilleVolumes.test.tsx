/**
 * <b>An owned volume only leaves the collection on the second gesture.</b>
 *
 * <p>The grid is a switch: a tap on a missing volume adds it, a
 * tap on an owned volume removed it at once - a real removal of the copy,
 * acquisition date included, which could only be recovered with the "Annuler" of the
 * message, for six seconds. With a finger, on a grid of seventy-four
 * cells, this is the easiest gesture to do without meaning to. Since batch
 * 148, the first tap ARMS the tile (it asks "Retirer ?"), the second
 * removes; "Garder" or any other volume disarms. Adding
 * stays a single gesture: it destroys nothing.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GrilleVolumes, type VolumeAffiche } from './GrilleVolumes'

function volume(numero: number, possede: boolean): VolumeAffiche {
  return { cle: String(numero), numero, jaquetteUrl: null, possede, voulu: false, actif: false }
}

function rendre(onRetirer = vi.fn(), onActiver = vi.fn()) {
  render(
    <GrilleVolumes
      volumes={[volume(1, true), volume(2, true), volume(3, false)]}
      mode="navigation"
      onActiver={onActiver}
      onRetirer={onRetirer}
      filtre="tous"
      onFiltre={() => {}}
    />,
  )
  return { onRetirer, onActiver }
}

describe('remove an owned volume', () => {
  it('asks for a second gesture: the first tap arms, the second removes', () => {
    const { onRetirer, onActiver } = rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))

    expect(onRetirer).not.toHaveBeenCalled()
    expect(onActiver).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Tome 1, possédé' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer le tome 1 de ma collection' }))

    expect(onRetirer).toHaveBeenCalledWith('1')
  })

  it('"Garder" disarms without removing anything', () => {
    const { onRetirer } = rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Garder le tome 1' }))

    expect(onRetirer).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Retirer le tome 1 de ma collection' })).not.toBeInTheDocument()
  })

  it('arming another volume disarms the first: only one question at a time', () => {
    rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, possédé' }))

    expect(screen.queryByRole('button', { name: 'Retirer le tome 1 de ma collection' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer le tome 2 de ma collection' })).toBeInTheDocument()
  })
})

describe('add a missing volume', () => {
  it('stays a single gesture - it destroys nothing', () => {
    const { onActiver, onRetirer } = rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 3, manquant' }))

    expect(onActiver).toHaveBeenCalledWith('3')
    expect(onRetirer).not.toHaveBeenCalled()
  })

  it('without "onRetirer", the owned tile keeps its previous gesture (selection mode or screen without removal)', () => {
    const onActiver = vi.fn()
    render(
      <GrilleVolumes
        volumes={[volume(1, true)]}
        mode="navigation"
        onActiver={onActiver}
        filtre="tous"
        onFiltre={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))

    expect(onActiver).toHaveBeenCalledWith('1')
  })
})
