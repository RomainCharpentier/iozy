/**
 * <b>Clair ou sombre d'un clic, depuis l'en-tête - et une icône qui dit vrai.</b>
 *
 * L'interrupteur vivait à trois clics, dans les Paramètres. Le bouton de
 * l'en-tête (lot 138) est rendu DEUX fois - barre desktop et barre mobile, dont
 * l'une est masquée par CSS - et c'est ce qui se vérifie ici : les deux disent
 * toujours la même chose, quel que soit celui qu'on a cliqué.
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

describe('l’icône et le nom', () => {
  it('montre le mode courant, et nomme l’action', () => {
    // Sombre par défaut : la lune est à l'écran, et le bouton propose le clair.
    render(<BoutonTheme />)

    const bouton = screen.getByRole('button', { name: 'Passer en thème clair' })
    expect(bouton).toHaveAttribute('title', 'Passer en thème clair')
    expect(bouton.querySelector('svg.lucide-moon')).not.toBeNull()
    // Une icône seule, comme ses voisines de l'en-tête.
    expect(bouton).toHaveTextContent('')
  })

  it('bascule, applique le thème à la page et le mémorise', async () => {
    render(<BoutonTheme />)

    await userEvent.click(screen.getByRole('button', { name: 'Passer en thème clair' }))

    const bouton = screen.getByRole('button', { name: 'Passer en thème sombre' })
    expect(bouton.querySelector('svg.lucide-sun')).not.toBeNull()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem('iozycore.theme')).toBe('light')
  })
})

describe('les deux barres', () => {
  it('disent la même chose, quel que soit le bouton cliqué', async () => {
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
