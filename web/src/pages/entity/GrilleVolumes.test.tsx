/**
 * <b>Un tome possédé ne sort de la collection qu'au second geste.</b>
 *
 * <p>La grille est un interrupteur : un tap sur un tome manquant l'ajoute, un
 * tap sur un tome possédé le retirait aussitôt - retrait réel de l'exemplaire,
 * date d'acquisition comprise, rattrapable seulement par le « Annuler » du
 * message, six secondes durant. Au doigt, sur une grille de soixante-quatorze
 * cases, c'est le geste le plus facile à faire sans le vouloir. Depuis le lot
 * 148, le premier tap ARME la tuile (elle demande « Retirer ? »), le second
 * retire ; « Garder » ou n'importe quel autre tome désarme. L'ajout, lui,
 * reste un seul geste : il ne détruit rien.
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

describe('retirer un tome possédé', () => {
  it('demande un second geste : le premier tap arme, le second retire', () => {
    const { onRetirer, onActiver } = rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))

    expect(onRetirer).not.toHaveBeenCalled()
    expect(onActiver).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Tome 1, possédé' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer le tome 1 de ma collection' }))

    expect(onRetirer).toHaveBeenCalledWith('1')
  })

  it('« Garder » désarme sans rien retirer', () => {
    const { onRetirer } = rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Garder le tome 1' }))

    expect(onRetirer).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Retirer le tome 1 de ma collection' })).not.toBeInTheDocument()
  })

  it('armer un autre tome désarme le premier : une seule question à la fois', () => {
    rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 1, possédé' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tome 2, possédé' }))

    expect(screen.queryByRole('button', { name: 'Retirer le tome 1 de ma collection' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer le tome 2 de ma collection' })).toBeInTheDocument()
  })
})

describe('ajouter un tome manquant', () => {
  it('reste un seul geste - il ne détruit rien', () => {
    const { onActiver, onRetirer } = rendre()

    fireEvent.click(screen.getByRole('button', { name: 'Tome 3, manquant' }))

    expect(onActiver).toHaveBeenCalledWith('3')
    expect(onRetirer).not.toHaveBeenCalled()
  })

  it('sans « onRetirer », la tuile possédée garde son geste d’avant (mode sélection ou écran sans retrait)', () => {
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
