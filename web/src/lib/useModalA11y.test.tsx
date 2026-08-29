/**
 * <b>Le clavier dans une surface modale : ouvrir, tourner en rond, ressortir.</b>
 *
 * Trois comportements que personne ne voit à la souris, et que rien d'autre ne
 * garde : <b>Échap ferme</b>, <b>Tab reste piégé</b> dans le dialogue, et le
 * focus <b>revient au déclencheur</b> à la fermeture. Sans le dernier, on
 * ferme un panneau et le curseur repart en haut de page - au clavier, on est
 * perdu ; au lecteur d'écran, on a changé de contexte sans le savoir.
 *
 * <h2>Une prothèse assumée : `offsetParent`</h2>
 * jsdom ne fait aucune mise en page, donc `offsetParent` y vaut toujours
 * `null` - or le hook s'en sert pour ignorer les éléments cachés, et sans
 * prothèse il ne trouverait <b>aucun</b> élément focusable : les tests
 * passeraient en ne vérifiant rien. On rend donc `offsetParent` non nul pour
 * les éléments réellement dans le document, ce qui est le seul point où ces
 * tests s'écartent d'un vrai navigateur.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { useModalA11y } from './useModalA11y'

const offsetParentOriginal = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return document.contains(this) ? document.body : null
    },
  })
})
afterAll(() => {
  if (offsetParentOriginal) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentOriginal)
})

function Dialogue({
  open,
  onClose,
  focusInitialSurNom = false,
}: {
  open: boolean
  onClose: () => void
  focusInitialSurNom?: boolean
}) {
  const ref = useModalA11y<HTMLDivElement>(open, onClose)
  if (!open) return null
  return (
    <div ref={ref} role="dialog">
      <button type="button">Fermer</button>
      <input aria-label="Nom" {...(focusInitialSurNom ? { 'data-modal-initial-focus': true } : {})} />
      <button type="button">Créer</button>
    </div>
  )
}

/** Ouvre le dialogue depuis un vrai déclencheur, qui a le focus. */
function ouvrir(options: { focusInitialSurNom?: boolean } = {}) {
  const onClose = vi.fn()
  function Ecran() {
    const [ouvert, setOuvert] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOuvert(true)}>
          Ouvrir
        </button>
        <Dialogue
          open={ouvert}
          onClose={() => {
            onClose()
            setOuvert(false)
          }}
          {...options}
        />
      </>
    )
  }
  render(<Ecran />)
  const declencheur = screen.getByRole('button', { name: 'Ouvrir' })
  declencheur.focus()
  fireEvent.click(declencheur)
  return { onClose, declencheur }
}

describe('à l’ouverture', () => {
  it('donne le focus au premier élément du dialogue', () => {
    ouvrir()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })

  it('respecte l’élément désigné, plutôt que l’ordre du DOM', () => {
    // « Nom » doit recevoir le focus, pas le bouton Fermer qui le précède.
    ouvrir({ focusInitialSurNom: true })

    expect(document.activeElement).toBe(screen.getByLabelText('Nom'))
  })
})

describe('pendant que le dialogue est ouvert', () => {
  it('ferme sur Échap', () => {
    const { onClose } = ouvrir()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ramène Tab au premier élément après le dernier', () => {
    ouvrir()
    screen.getByRole('button', { name: 'Créer' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })

  it('renvoie Maj+Tab au dernier élément depuis le premier', () => {
    ouvrir()
    screen.getByRole('button', { name: 'Fermer' }).focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Créer' }))
  })

  it('rattrape un focus parti hors du dialogue', () => {
    ouvrir()
    screen.getByRole('button', { name: 'Ouvrir' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })
})

describe('à la fermeture', () => {
  it('rend le focus au déclencheur', () => {
    const { declencheur } = ouvrir()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.activeElement).toBe(declencheur)
  })
})
