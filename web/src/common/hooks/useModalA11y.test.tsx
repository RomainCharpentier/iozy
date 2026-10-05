/**
 * <b>The keyboard in a modal surface: open, go around in circles, get out.</b>
 *
 * Three behaviors that nobody sees with a mouse, and that nothing else
 * guards: <b>Escape closes</b>, <b>Tab stays trapped</b> in the dialog, and
 * the focus <b>goes back to the trigger</b> on close. Without the last one,
 * you close a panel and the cursor starts again at the top of the page - with
 * a keyboard, you are lost; with a screen reader, you changed context without
 * knowing it.
 *
 * <h2>A deliberate prosthesis: `offsetParent`</h2>
 * jsdom does no layout, so `offsetParent` is always `null` there - but the
 * hook uses it to ignore hidden elements, and without a prosthesis it would
 * find <b>no</b> focusable element: the tests would pass while checking
 * nothing. So we make `offsetParent` non-null for the elements that are
 * really in the document, which is the only point where these tests differ
 * from a real browser.
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

/** Opens the dialog from a real trigger, which has the focus. */
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

describe('on opening', () => {
  it('gives the focus to the first element of the dialog', () => {
    ouvrir()

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })

  it('respects the designated element, rather than the DOM order', () => {
    // "Nom" must receive the focus, not the Fermer button that precedes it.
    ouvrir({ focusInitialSurNom: true })

    expect(document.activeElement).toBe(screen.getByLabelText('Nom'))
  })
})

describe('while the dialog is open', () => {
  it('closes on Escape', () => {
    const { onClose } = ouvrir()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('brings Tab back to the first element after the last one', () => {
    ouvrir()
    screen.getByRole('button', { name: 'Créer' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })

  it('sends Shift+Tab to the last element from the first one', () => {
    ouvrir()
    screen.getByRole('button', { name: 'Fermer' }).focus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Créer' }))
  })

  it('catches a focus that went outside the dialog', () => {
    ouvrir()
    screen.getByRole('button', { name: 'Ouvrir' }).focus()

    fireEvent.keyDown(document, { key: 'Tab' })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fermer' }))
  })
})

describe('on closing', () => {
  it('gives the focus back to the trigger', () => {
    const { declencheur } = ouvrir()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.activeElement).toBe(declencheur)
  })
})
