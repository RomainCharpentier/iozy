/**
 * <b>The filter panel, and the tag that could be set without ever being
 * used.</b>
 *
 * <p>Tags were created and attached from a detail page, and no screen
 * read them back afterwards. This panel is where this sorting becomes
 * useful again - three rules break silently here, because each time the
 * panel <b>is shown anyway</b>:
 * <ul>
 *   <li>the "Tag" section appears although no tag exists: a filter that
 *       cannot keep anything, which suggests that something is missing;</li>
 *   <li>"Tous" does not come back to the absence of a filter: no more way to
 *       see the whole collection again without reloading;</li>
 *   <li>"Réinitialiser" only listens to the collection state: a tag alone
 *       active, and the button stays invisible.</li>
 * </ul>
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CollectionFilters } from './CollectionFilters'
import { tag } from '@/test/fixtures'

const LU = tag('Lu')
const A_RELIRE = tag('À relire')

function panneau(props: Partial<Parameters<typeof CollectionFilters>[0]> = {}) {
  const onTagChange = vi.fn()
  const onStatusChange = vi.fn()
  const onReset = vi.fn()
  render(
    <CollectionFilters
      open
      onClose={vi.fn()}
      status="ALL"
      onStatusChange={onStatusChange}
      tags={[LU, A_RELIRE]}
      tagId={null}
      onTagChange={onTagChange}
      onReset={onReset}
      {...props}
    />,
  )
  return { onTagChange, onStatusChange, onReset }
}

describe('the Tag section', () => {
  it('lists the existing tags, preceded by "Tous"', () => {
    panneau()

    const groupe = screen.getByRole('radiogroup', { name: 'Tag' })
    expect(groupe).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Tous' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Lu' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'À relire' })).toBeInTheDocument()
  })

  it("does not appear while no tag exists", () => {
    panneau({ tags: [] })

    expect(screen.queryByRole('radiogroup', { name: 'Tag' })).not.toBeInTheDocument()
    // The state filter is always there: it is the Tag section that
    // disappears, not the panel.
    expect(screen.getByRole('radiogroup', { name: 'État de la collection' })).toBeInTheDocument()
  })

  it('reports the chosen tag', async () => {
    const { onTagChange } = panneau()

    await userEvent.click(screen.getByRole('radio', { name: 'Lu' }))

    expect(onTagChange).toHaveBeenCalledWith(LU.id)
  })

  it('"Tous" reports the absence of a filter, not an identifier', async () => {
    const { onTagChange } = panneau({ tagId: LU.id })

    await userEvent.click(screen.getByRole('radio', { name: 'Tous' }))

    expect(onTagChange).toHaveBeenCalledWith(null)
  })

  it('marks the active tag, and only it', () => {
    panneau({ tagId: LU.id })

    expect(screen.getByRole('radio', { name: 'Lu' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'À relire' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Tous' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('"Réinitialiser"', () => {
  it('stays absent when nothing filters', () => {
    panneau()

    expect(screen.queryByRole('button', { name: 'Réinitialiser' })).not.toBeInTheDocument()
  })

  it('appears for a tag alone, without a state filter', async () => {
    const { onReset } = panneau({ tagId: LU.id })

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(onReset).toHaveBeenCalled()
  })

  it('appears for a state filter alone, without a tag', () => {
    panneau({ status: 'INCOMPLETE' })

    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeInTheDocument()
  })
})
