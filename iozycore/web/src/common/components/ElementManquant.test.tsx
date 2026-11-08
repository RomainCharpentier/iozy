/**
 * <b>A missing element says what a click does, not what it is missing.</b>
 * No state label is written; the accessible name carries the gesture.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ElementManquant } from './ElementManquant'

describe('a missing element', () => {
  it('is named "<label> : je l\'ai" and adds in one click', () => {
    const onJeLAi = vi.fn()
    render(<ElementManquant libelle="Tome 12" onJeLAi={onJeLAi}>12</ElementManquant>)

    fireEvent.click(screen.getByRole('button', { name: "Tome 12 : je l'ai" }))

    expect(onJeLAi).toHaveBeenCalledTimes(1)
  })

  it('writes no state label under the element', () => {
    render(<ElementManquant libelle="Tome 12" onJeLAi={() => {}}>12</ElementManquant>)

    expect(screen.queryByText(/manquant/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent(/^12$/)
  })
})
