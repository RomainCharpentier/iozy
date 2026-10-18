/**
 * <b>Light or dark in one click, from the header - and an icon that tells the truth.</b>
 *
 * The switch lived three clicks away, in the Settings. The header
 * button (batch 138) is rendered TWICE - desktop bar and mobile bar, one of which
 * is hidden by CSS - and this is what is checked here: both always say
 * the same thing, whichever one was clicked.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { BoutonTheme } from './BoutonTheme'
import { applyStoredTheme } from '@/common/lib/theme'

beforeEach(() => {
  localStorage.clear()
  applyStoredTheme()
})

describe('the icon and the name', () => {
  it('shows the current mode, and names the action', () => {
    // Dark by default: the moon is on screen, and the button offers light.
    render(<BoutonTheme />)

    const bouton = screen.getByRole('button', { name: 'Passer en thème clair' })
    expect(bouton).toHaveAttribute('title', 'Passer en thème clair')
    expect(bouton.querySelector('svg.lucide-moon')).not.toBeNull()
    // An icon only, like its neighbors in the header.
    expect(bouton).toHaveTextContent('')
  })

  it('toggles, applies the theme to the page and remembers it', async () => {
    render(<BoutonTheme />)

    await userEvent.click(screen.getByRole('button', { name: 'Passer en thème clair' }))

    const bouton = screen.getByRole('button', { name: 'Passer en thème sombre' })
    expect(bouton.querySelector('svg.lucide-sun')).not.toBeNull()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('iozycore.theme')).toBe('light')
  })
})

describe('the two bars', () => {
  it('say the same thing, whichever button was clicked', async () => {
    render(
      <>
        <BoutonTheme />
        <BoutonTheme compact />
      </>,
    )

    await userEvent.click(screen.getAllByRole('button', { name: 'Passer en thème clair' })[0])

    expect(screen.getAllByRole('button', { name: 'Passer en thème sombre' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Passer en thème clair' })).not.toBeInTheDocument()
  })
})
