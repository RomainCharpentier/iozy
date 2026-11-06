/**
 * <b>The console is asked only when there is something to ask.</b>
 * A game that exists on one console needs no question, and answering stays
 * optional: nothing here may block saying "I have it".
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AjoutDirect } from './AjoutDirect'

function afficher(consoles: string[]) {
  const onAjouter = vi.fn()
  render(<AjoutDirect onAjouter={onAjouter} enCours={false} attente={false} erreur={null} consoles={consoles} />)
  return onAjouter
}

const AJOUTER = { name: 'Ajouter à ma collection' }

describe('adding a work without volumes', () => {
  it('asks nothing for a work without a known console', async () => {
    const onAjouter = afficher([])

    expect(screen.queryByText('Sur quelle console ?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', AJOUTER))

    expect(onAjouter).toHaveBeenCalledWith(undefined)
  })

  it('takes the only console without asking', async () => {
    const onAjouter = afficher(['Nintendo Switch'])

    expect(screen.queryByText('Sur quelle console ?')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', AJOUTER))

    expect(onAjouter).toHaveBeenCalledWith('Nintendo Switch')
  })

  it('sends the chosen console as the source names it, and shows its short name', async () => {
    const onAjouter = afficher(['PC (Microsoft Windows)', 'PlayStation 5'])

    await userEvent.click(screen.getByRole('radio', { name: 'PC' }))
    await userEvent.click(screen.getByRole('button', AJOUTER))

    expect(onAjouter).toHaveBeenCalledWith('PC (Microsoft Windows)')
  })

  it('never blocks: without an answer, the game is added and waits', async () => {
    const onAjouter = afficher(['PC (Microsoft Windows)', 'PlayStation 5'])

    await userEvent.click(screen.getByRole('button', AJOUTER))

    expect(onAjouter).toHaveBeenCalledWith(undefined)
  })
})
